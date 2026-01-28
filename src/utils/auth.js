import { STORAGE_KEYS, getItem, setItem, removeItem } from './storage';
import { supabase } from './supabase';

// Session expires after 10 hours (in milliseconds)
const SESSION_DURATION = 10 * 60 * 60 * 1000;

/**
 * 비밀번호 해시 생성 (간단한 해시 - 프로덕션에서는 bcrypt 사용 권장)
 */
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * 회원가입
 */
export const register = async (userData) => {
    try {
        const { nickname, password, employeeId, gender, personality, profileIconUrl, profileIconPrompt } = userData;

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
                employee_id: employeeId || null,
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
        const passwordHash = await hashPassword(password);
        if (dbUser.password_hash !== passwordHash) {
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

        setItem(STORAGE_KEYS.USER, user);
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
        // 현재 비밀번호 확인
        const currentHash = await hashPassword(currentPassword);

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, password_hash')
            .eq('nickname', nickname)
            .single();

        if (fetchError || !user) {
            return { success: false, error: '사용자를 찾을 수 없습니다.' };
        }

        if (user.password_hash !== currentHash) {
            return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
        }

        // 새 비밀번호로 업데이트
        const newHash = await hashPassword(newPassword);

        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', user.id);

        if (updateError) {
            return { success: false, error: '비밀번호 변경에 실패했습니다.' };
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

export const login = (nickname, password = null) => {
    const user = {
        nickname,
        isAdmin: false,
        isRegistered: false,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };

    // Check if admin login
    if (nickname === 'admin') {
        const adminPassword = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
        if (password === adminPassword) {
            user.isAdmin = true;
        } else {
            return { success: false, error: 'Invalid admin password' };
        }
    }

    setItem(STORAGE_KEYS.USER, user);
    return { success: true, user };
};

export const logout = () => {
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

    return user;
};

export const isAuthenticated = () => {
    return getCurrentUser() !== null;
};

export const isAdmin = () => {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
};

export const updateAdminPassword = (newPassword) => {
    if (!isAdmin()) {
        return { success: false, error: 'Unauthorized' };
    }
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword);
    return { success: true };
};

export const getAdminPassword = () => {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
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
    }
};
