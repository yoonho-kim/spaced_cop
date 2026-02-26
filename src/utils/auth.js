import { STORAGE_KEYS, getItem, setItem, removeItem } from './clientStorage';
import { supabase } from './supabase';

// Session expires after 10 hours (in milliseconds)
const SESSION_DURATION = 10 * 60 * 60 * 1000;
const HONORIFIC_REGEX = /^[가-힣]{1,4}$/;
const PASSWORD_HASH_VERSION = 'pbkdf2_sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

let verifiedAdminSession = null;

const normalizeHonorifics = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 2);
};

const validateHonorifics = (value) => {
    if (value == null) return { valid: true, normalized: [] };
    if (!Array.isArray(value)) {
        return { valid: false, error: '호칭 형식이 올바르지 않습니다.' };
    }
    if (value.length > 2) {
        return { valid: false, error: '호칭은 최대 2개까지 설정할 수 있습니다.' };
    }
    if (value.some((item) => typeof item !== 'string')) {
        return { valid: false, error: '호칭 형식이 올바르지 않습니다.' };
    }
    if (value.some((item) => !item.trim())) {
        return { valid: false, error: '호칭 형식이 올바르지 않습니다.' };
    }

    const normalized = normalizeHonorifics(value);
    if (normalized.some((title) => !HONORIFIC_REGEX.test(title))) {
        return { valid: false, error: '호칭은 한글 1~4글자만 입력할 수 있습니다.' };
    }
    return { valid: true, normalized };
};

const textEncoder = new TextEncoder();

const createAdminSessionFingerprint = (user) => {
    const id = user?.id == null ? '' : String(user.id);
    const nickname = user?.nickname ? String(user.nickname) : '';
    return `${id}:${nickname}`;
};

const markAdminSessionVerified = (user) => {
    verifiedAdminSession = {
        fingerprint: createAdminSessionFingerprint(user),
        expiresAt: user?.expiresAt || new Date(Date.now() + SESSION_DURATION).toISOString(),
    };
};

const clearAdminSessionVerification = () => {
    verifiedAdminSession = null;
};

const hasVerifiedAdminSession = (user) => {
    if (!user || user.isAdmin !== true || !verifiedAdminSession) return false;

    if (verifiedAdminSession.fingerprint !== createAdminSessionFingerprint(user)) {
        return false;
    }

    if (!verifiedAdminSession.expiresAt) return false;
    return new Date(verifiedAdminSession.expiresAt) > new Date();
};

const timingSafeEqualString = (left, right) => {
    if (typeof left !== 'string' || typeof right !== 'string') return false;

    const maxLength = Math.max(left.length, right.length);
    let mismatch = left.length === right.length ? 0 : 1;

    for (let i = 0; i < maxLength; i += 1) {
        const leftCode = i < left.length ? left.charCodeAt(i) : 0;
        const rightCode = i < right.length ? right.charCodeAt(i) : 0;
        mismatch |= leftCode ^ rightCode;
    }

    return mismatch === 0;
};

const timingSafeEqualBytes = (left, right) => {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;

    const maxLength = Math.max(left.length, right.length);
    let mismatch = left.length === right.length ? 0 : 1;

    for (let i = 0; i < maxLength; i += 1) {
        const leftValue = i < left.length ? left[i] : 0;
        const rightValue = i < right.length ? right[i] : 0;
        mismatch |= leftValue ^ rightValue;
    }

    return mismatch === 0;
};

const toBase64 = (bytes) => {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

const fromBase64 = (value) => {
    const binary = atob(value);
    const output = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        output[i] = binary.charCodeAt(i);
    }
    return output;
};

const hashPasswordLegacySha256 = async (password) => {
    const data = textEncoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const derivePbkdf2Hash = async (password, salt, iterations) => {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt,
            iterations,
        },
        keyMaterial,
        PASSWORD_HASH_BYTES * 8
    );

    return new Uint8Array(bits);
};

/**
 * 비밀번호 해시 생성 (PBKDF2-SHA256 + 고유 salt)
 */
const hashPassword = async (password) => {
    const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
    const derived = await derivePbkdf2Hash(password, salt, PASSWORD_HASH_ITERATIONS);
    return `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
};

const verifyPassword = async (password, storedHash) => {
    if (typeof storedHash !== 'string' || !storedHash.trim()) {
        return { valid: false, needsRehash: false };
    }

    const parts = storedHash.split('$');
    if (parts.length === 4 && parts[0] === PASSWORD_HASH_VERSION) {
        const iterations = Number(parts[1]);
        if (!Number.isInteger(iterations) || iterations < 10000) {
            return { valid: false, needsRehash: false };
        }

        try {
            const salt = fromBase64(parts[2]);
            const expected = fromBase64(parts[3]);
            const derived = await derivePbkdf2Hash(password, salt, iterations);
            const valid = timingSafeEqualBytes(derived, expected);
            return { valid, needsRehash: valid && iterations < PASSWORD_HASH_ITERATIONS };
        } catch (error) {
            console.error('Password verify parse error:', error);
            return { valid: false, needsRehash: false };
        }
    }

    // Legacy SHA-256 hash support (auto-upgrade after successful login)
    const legacyHash = await hashPasswordLegacySha256(password);
    const valid = timingSafeEqualString(legacyHash, storedHash);
    return { valid, needsRehash: valid };
};

/**
 * 회원가입
 */
export const register = async (userData) => {
    try {
        const { nickname, password, employeeId, gender, personality, profileIconUrl, profileIconPrompt } = userData;
        const normalizedEmployeeId = typeof employeeId === 'string' ? employeeId.trim() : '';

        if (!normalizedEmployeeId) {
            return { success: false, error: '사번을 입력해주세요.' };
        }

        // 닉네임 중복 체크
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .single();

        if (existingUser) {
            return { success: false, error: '이미 사용 중인 닉네임입니다.' };
        }

        // 비밀번호 해시
        const passwordHash = await hashPassword(password);

        // 사용자 생성
        const { data, error } = await supabase
            .from('users')
            .insert([{
                nickname,
                password_hash: passwordHash,
                employee_id: normalizedEmployeeId,
                gender: gender || null,
                personality_time: personality?.time || null,
                personality_feeling: personality?.feeling || null,
                personality_place: personality?.place || null,
                profile_icon_url: profileIconUrl || null,
                profile_icon_prompt: profileIconPrompt || null,
                is_admin: false
            }])
            .select()
            .single();

        if (error) {
            console.error('Registration error:', error);
            return { success: false, error: '회원가입 중 오류가 발생했습니다.' };
        }

        return { success: true, user: data };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 닉네임 중복 체크
 */
export const checkNicknameAvailability = async (nickname) => {
    try {
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', nickname)
            .single();

        if (error && error.code === 'PGRST116') {
            // No rows found - nickname is available
            return { success: true, available: true };
        }

        if (existingUser) {
            return { success: true, available: false };
        }

        return { success: true, available: true };
    } catch (error) {
        console.error('Check nickname error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * DB 인증 로그인
 */
export const loginWithPassword = async (nickname, password) => {
    try {
        // 사용자 조회
        const { data: dbUser, error } = await supabase
            .from('users')
            .select('*')
            .eq('nickname', nickname)
            .single();

        if (error || !dbUser) {
            return { success: false, error: '등록되지 않은 사용자입니다.' };
        }

        // 비밀번호 확인
        const verified = await verifyPassword(password, dbUser.password_hash);
        if (!verified.valid) {
            return { success: false, error: '비밀번호가 일치하지 않습니다.' };
        }

        // 세션 생성
        const user = {
            id: dbUser.id,
            nickname: dbUser.nickname,
            employeeId: dbUser.employee_id,
            gender: dbUser.gender,
            profileIconUrl: dbUser.profile_icon_url,
            isAdmin: dbUser.is_admin,
            isRegistered: true,
            loginTime: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
        };

        if (user.isAdmin) {
            markAdminSessionVerified(user);
        } else {
            clearAdminSessionVerification();
        }

        setItem(STORAGE_KEYS.USER, user);

        // Legacy hash를 사용 중이거나 iteration이 낮으면 로그인 시점에 자동 업그레이드
        if (verified.needsRehash) {
            const upgradedHash = await hashPassword(password);
            const { error: rehashError } = await supabase
                .from('users')
                .update({ password_hash: upgradedHash })
                .eq('id', dbUser.id);

            if (rehashError) {
                console.warn('Password hash upgrade skipped:', rehashError);
            }
        }

        return { success: true, user };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 비밀번호 변경
 */
export const changePassword = async (nickname, currentPassword, newPassword) => {
    try {
        // 1. 현재 비밀번호가 맞는지 조회
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, password_hash')
            .eq('nickname', nickname)
            .single();

        if (fetchError || !user) {
            return { success: false, error: '사용자를 찾을 수 없습니다.' };
        }

        const verified = await verifyPassword(currentPassword, user.password_hash);
        if (!verified.valid) {
            return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
        }

        const newHash = await hashPassword(newPassword);

        // 2. 새 비밀번호로 업데이트 시도 (select: 'minimal'로 실제 수정 여부 확인)
        const { data, error: updateError } = await supabase
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', user.id)
            .select();

        // Supabase update error 체크
        if (updateError) {
            console.error('Update operation error:', updateError);
            return { success: false, error: '비밀번호 변경 중 데이터베이스 오류가 발생했습니다.' };
        }

        // 업데이트된 행이 없는 경우 (주로 RLS 정책에 의해 차단됨)
        if (!data || data.length === 0) {
            console.warn('No rows updated. Connection successful but update failed. This usually means Supabase RLS policy blocks UPDATE for "anon" role on "users" table.');
            return {
                success: false,
                error: '비밀번호 변경 권한이 제한되었습니다. Supabase RLS 정책을 확인하거나 관리자에게 문의하세요.'
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Change password error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 닉네임으로 사용자 조회 (비밀번호 찾기용)
 */
export const findUserByNickname = async (nickname) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, nickname, employee_id')
            .eq('nickname', nickname)
            .single();

        if (error || !data) {
            return { success: false, error: '등록되지 않은 사용자입니다.' };
        }

        return { success: true, user: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// ===== 기존 함수들 (게스트 로그인 호환) =====

/**
 * 로그인 (관리자 및 게스트 통합)
 */
export const login = async (nickname, password = null) => {
    // 관리자 로그인 시 DB 인증 사용
    if (nickname.toLowerCase() === 'admin') {
        if (!password) {
            return { success: false, error: '비밀번호를 입력해주세요.' };
        }
        return await loginWithPassword(nickname, password);
    }

    // 게스트 로그인 (보안상 권장되지 않으나 기존 호환성 유지)
    const user = {
        nickname,
        isAdmin: false,
        isRegistered: false,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };

    clearAdminSessionVerification();
    setItem(STORAGE_KEYS.USER, user);
    return { success: true, user };
};

export const logout = () => {
    clearAdminSessionVerification();
    removeItem(STORAGE_KEYS.USER);
};

export const getCurrentUser = () => {
    const user = getItem(STORAGE_KEYS.USER);

    if (!user) return null;

    // Check if session has expired
    if (user.expiresAt) {
        const expiresAt = new Date(user.expiresAt);
        if (new Date() > expiresAt) {
            // Session expired, clear user data
            logout();
            return null;
        }
    }

    if (user.isAdmin === true && !hasVerifiedAdminSession(user)) {
        const downgradedUser = { ...user, isAdmin: false };
        setItem(STORAGE_KEYS.USER, downgradedUser);
        return downgradedUser;
    }

    return user;
};

export const isAuthenticated = () => {
    return getCurrentUser() !== null;
};

export const isAdmin = () => {
    const user = getCurrentUser();
    return !!(user && user.isAdmin === true && hasVerifiedAdminSession(user));
};

/**
 * 관리자 비밀번호 변경 (DB 기반)
 */
export const updateAdminPassword = async (newPassword) => {
    if (!isAdmin()) {
        return { success: false, error: '권한이 없습니다.' };
    }

    try {
        const user = getCurrentUser();
        const newHash = await hashPassword(newPassword);

        const { data, error } = await supabase
            .from('users')
            .update({ password_hash: newHash })
            .eq('nickname', user.nickname)
            .select();

        if (error) {
            console.error('Admin password update error:', error);
            return { success: false, error: '데이터베이스 오류가 발생했습니다.' };
        }

        if (!data || data.length === 0) {
            return { success: false, error: '비밀번호를 변경할 수 없습니다. RLS 정책을 확인하세요.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Admin password update error:', error);
        return { success: false, error: error.message };
    }
};

export const getAdminPassword = () => {
    // 더 이상 사용되지 않음 (DB 기반 보안)
    return null;
};

// ==============================
// Admin User Management
// ==============================

export const adminGetUsers = async () => {
    if (!isAdmin()) {
        return { success: false, error: '권한이 없습니다.' };
    }

    try {
        let { data, error } = await supabase
            .from('users')
            .select('id, nickname, employee_id, gender, honorifics, is_admin, created_at')
            .order('created_at', { ascending: false });

        if (error && String(error.message || '').includes('honorifics')) {
            const fallbackResult = await supabase
                .from('users')
                .select('id, nickname, employee_id, gender, is_admin, created_at')
                .order('created_at', { ascending: false });
            data = fallbackResult.data;
            error = fallbackResult.error;
        }

        if (error) {
            console.error('Admin get users error:', error);
            return { success: false, error: '사용자 목록을 불러올 수 없습니다.' };
        }

        const users = (data || []).map(u => ({
            id: u.id,
            nickname: u.nickname,
            employeeId: u.employee_id,
            gender: u.gender,
            honorifics: normalizeHonorifics(u.honorifics),
            isAdmin: u.is_admin,
            createdAt: u.created_at,
        }));

        return { success: true, users };
    } catch (error) {
        console.error('Admin get users error:', error);
        return { success: false, error: error.message };
    }
};

export const adminUpdateUserBasicInfo = async (userId, updates) => {
    if (!isAdmin()) {
        return { success: false, error: '권한이 없습니다.' };
    }

    try {
        const dbUpdates = {};
        if ('employeeId' in updates) dbUpdates.employee_id = updates.employeeId || null;
        if ('gender' in updates) dbUpdates.gender = updates.gender || null;
        if ('honorifics' in updates) {
            const validated = validateHonorifics(updates.honorifics);
            if (!validated.valid) {
                return { success: false, error: validated.error };
            }
            dbUpdates.honorifics = validated.normalized;
        }

        if (Object.keys(dbUpdates).length === 0) {
            return { success: true };
        }

        const { data, error } = await supabase
            .from('users')
            .update(dbUpdates)
            .eq('id', userId)
            .select();

        if (error) {
            console.error('Admin update user error:', error);
            if (String(error.message || '').includes('honorifics')) {
                return { success: false, error: 'DB에 honorifics 컬럼이 없습니다. SQL 마이그레이션을 먼저 실행해주세요.' };
            }
            return { success: false, error: '사용자 정보를 업데이트할 수 없습니다.' };
        }

        if (!data || data.length === 0) {
            return { success: false, error: '업데이트 권한이 없습니다. RLS 정책을 확인하세요.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Admin update user error:', error);
        return { success: false, error: error.message };
    }
};

export const adminResetUserPassword = async (userId, newPassword) => {
    if (!isAdmin()) {
        return { success: false, error: '권한이 없습니다.' };
    }

    try {
        const newHash = await hashPassword(newPassword);
        const { data, error } = await supabase
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', userId)
            .select();

        if (error) {
            console.error('Admin reset password error:', error);
            return { success: false, error: '비밀번호를 초기화할 수 없습니다.' };
        }

        if (!data || data.length === 0) {
            return { success: false, error: '비밀번호 변경 권한이 없습니다. RLS 정책을 확인하세요.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Admin reset password error:', error);
        return { success: false, error: error.message };
    }
};

// Get remaining session time in minutes
export const getSessionRemainingTime = () => {
    const user = getItem(STORAGE_KEYS.USER);
    if (!user || !user.expiresAt) return 0;

    const remaining = new Date(user.expiresAt) - new Date();
    return Math.max(0, Math.floor(remaining / 60000)); // Return minutes
};

// Extend session (refresh expiration time)
export const extendSession = () => {
    const user = getItem(STORAGE_KEYS.USER);
    if (user) {
        user.expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
        setItem(STORAGE_KEYS.USER, user);

        if (verifiedAdminSession && verifiedAdminSession.fingerprint === createAdminSessionFingerprint(user)) {
            verifiedAdminSession.expiresAt = user.expiresAt;
        }
    }
};
