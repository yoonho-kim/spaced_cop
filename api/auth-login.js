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
  const nickname = String(body?.nickname || '').trim();
  const password = String(body?.password || '');

  if (!nickname || !password) {
    response.status(400).json({ success: false, error: '닉네임과 비밀번호를 입력해주세요.' });
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
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, nickname, employee_id, gender, profile_icon_url, is_admin, password_hash')
      .eq('nickname', nickname)
      .single();

    if (userError || !dbUser) {
      response.status(401).json({ success: false, error: '등록되지 않은 사용자입니다.' });
      return;
    }

    const verified = verifyPassword(password, dbUser.password_hash);
    if (!verified.valid) {
      response.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

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
