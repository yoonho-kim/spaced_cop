/* global process, Buffer */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  applyCors,
  createSessionToken,
  enforceRateLimit,
  parseRequestBody,
  setSessionCookie,
} from './_security.js';

const SESSION_TTL_SECONDS = 10 * 60 * 60;
const PASSWORD_HASH_VERSION = 'pbkdf2_sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

const timingSafeEqualBytes = (left, right) => {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right)) return false;
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const hashPasswordLegacySha256 = (password) => (
  crypto.createHash('sha256').update(String(password)).digest('hex')
);

const derivePbkdf2Hash = (password, salt, iterations) => (
  crypto.pbkdf2Sync(String(password), salt, iterations, PASSWORD_HASH_BYTES, 'sha256')
);

const buildPasswordHash = (password) => {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const derived = derivePbkdf2Hash(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
};

const verifyPassword = (password, storedHash) => {
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
      const salt = Buffer.from(parts[2], 'base64');
      const expected = Buffer.from(parts[3], 'base64');
      const derived = derivePbkdf2Hash(password, salt, iterations);
      const valid = timingSafeEqualBytes(derived, expected);
      return { valid, needsRehash: valid && iterations < PASSWORD_HASH_ITERATIONS };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  const legacyHash = hashPasswordLegacySha256(password);
  const expected = Buffer.from(legacyHash);
  const current = Buffer.from(String(storedHash));
  const valid = expected.length === current.length && crypto.timingSafeEqual(expected, current);
  return { valid, needsRehash: valid };
};

const collectDistinctUsers = (...candidates) => {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.id || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
};

const findUsersByLoginIdentifier = async (supabase, identifier) => {
  const [nicknameResult, employeeIdResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, nickname, employee_id, gender, profile_icon_url, is_admin, password_hash')
      .eq('nickname', identifier)
      .maybeSingle(),
    supabase
      .from('users')
      .select('id, nickname, employee_id, gender, profile_icon_url, is_admin, password_hash')
      .eq('employee_id', identifier)
      .maybeSingle(),
  ]);

  if (nicknameResult.error) {
    throw nicknameResult.error;
  }

  if (employeeIdResult.error) {
    throw employeeIdResult.error;
  }

  return collectDistinctUsers(nicknameResult.data, employeeIdResult.data);
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  if (!enforceRateLimit(request, response, { key: 'auth-login', max: 20, windowMs: 15 * 60_000 })) {
    return;
  }

  const body = parseRequestBody(request);
  const identifier = String(body?.identifier ?? body?.nickname ?? '').trim();
  const password = String(body?.password || '');

  if (!identifier || !password) {
    response.status(400).json({ success: false, error: '닉네임 또는 사번과 비밀번호를 입력해주세요.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseServerKey) {
    response.status(500).json({
      success: false,
      error: 'SUPABASE 연결 환경변수가 설정되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_ANON_KEY 필요)',
    });
    return;
  }

  const sessionSecret = process.env.API_SESSION_SECRET;
  if (!sessionSecret) {
    response.status(500).json({
      success: false,
      error: 'API_SESSION_SECRET 환경변수가 설정되지 않았습니다.',
    });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServerKey, {
    auth: { persistSession: false },
  });

  try {
    const loginCandidates = await findUsersByLoginIdentifier(supabase, identifier);
    if (!loginCandidates.length) {
      response.status(401).json({ success: false, error: '등록되지 않은 사용자입니다.' });
      return;
    }

    const matchingUsers = loginCandidates
      .map((dbUser) => ({ dbUser, verified: verifyPassword(password, dbUser.password_hash) }))
      .filter(({ verified }) => verified.valid);

    if (!matchingUsers.length) {
      response.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (matchingUsers.length > 1) {
      response.status(409).json({
        success: false,
        error: '닉네임과 사번이 다른 계정과 겹칩니다. 닉네임으로 로그인해주세요.',
      });
      return;
    }

    const { dbUser, verified } = matchingUsers[0];
    if (verified.needsRehash) {
      const upgradedHash = buildPasswordHash(password);
      const { error: rehashError } = await supabase
        .from('users')
        .update({ password_hash: upgradedHash })
        .eq('id', dbUser.id);
      if (rehashError) {
        console.warn('Password hash upgrade skipped:', rehashError);
      }
    }

    const token = createSessionToken(
      {
        uid: dbUser.id,
        nickname: dbUser.nickname,
        isAdmin: dbUser.is_admin === true,
      },
      sessionSecret,
      SESSION_TTL_SECONDS,
    );
    setSessionCookie(request, response, token, SESSION_TTL_SECONDS);

    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    response.status(200).json({
      success: true,
      user: {
        id: dbUser.id,
        nickname: dbUser.nickname,
        employeeId: dbUser.employee_id,
        gender: dbUser.gender,
        profileIconUrl: dbUser.profile_icon_url,
        isAdmin: dbUser.is_admin === true,
        isRegistered: true,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Auth login error:', error);
    response.status(500).json({
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다.',
    });
  }
}
