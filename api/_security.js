/* global process, Buffer */
import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'spaced_session';
const SESSION_TTL_SECONDS = 10 * 60 * 60;
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

const RATE_BUCKETS = globalThis.__spacedRateBuckets || new Map();
if (!globalThis.__spacedRateBuckets) {
  globalThis.__spacedRateBuckets = RATE_BUCKETS;
}

const parseCsv = (value) => (
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

const getRequestHost = (request) => (
  request.headers?.['x-forwarded-host']
  || request.headers?.host
  || ''
);

const getRequestProto = (request) => {
  const forwardedProto = String(request.headers?.['x-forwarded-proto'] || '').trim();
  if (forwardedProto) return forwardedProto.split(',')[0].trim();

  const host = getRequestHost(request);
  if (host.includes('localhost') || host.startsWith('127.0.0.1')) {
    return 'http';
  }
  return 'https';
};

const getAllowedOrigins = (request) => {
  const allowed = new Set(parseCsv(process.env.ALLOWED_ORIGINS));
  const host = getRequestHost(request);
  if (host) {
    allowed.add(`${getRequestProto(request)}://${host}`);
  }

  allowed.add('http://localhost:5173');
  allowed.add('http://127.0.0.1:5173');
  return allowed;
};

const isAllowedOrigin = (request, origin) => {
  if (!origin) return true;
  const allowedOrigins = getAllowedOrigins(request);
  return allowedOrigins.has(origin);
};

const appendVaryHeader = (response, value) => {
  const current = response.getHeader('Vary');
  if (!current) {
    response.setHeader('Vary', value);
    return;
  }

  const values = String(current)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.includes(value)) {
    values.push(value);
    response.setHeader('Vary', values.join(', '));
  }
};

export const applyCors = (
  request,
  response,
  {
    methods = 'GET,POST,OPTIONS',
    headers = DEFAULT_ALLOWED_HEADERS,
  } = {},
) => {
  const requestOrigin = String(request.headers?.origin || '').trim();
  if (requestOrigin && !isAllowedOrigin(request, requestOrigin)) {
    response.status(403).json({ success: false, error: 'Origin Not Allowed' });
    return false;
  }

  if (requestOrigin) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
    appendVaryHeader(response, 'Origin');
  }
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Methods', methods);
  response.setHeader('Access-Control-Allow-Headers', headers);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return false;
  }

  return true;
};

export const parseRequestBody = (request) => {
  if (!request?.body) return {};

  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  if (typeof request.body === 'object') {
    return request.body;
  }

  return {};
};

const getRequestIp = (request) => {
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
};

const cleanExpiredBuckets = (now) => {
  if (RATE_BUCKETS.size < 2000) return;
  for (const [bucketKey, bucket] of RATE_BUCKETS.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      RATE_BUCKETS.delete(bucketKey);
    }
  }
};

export const enforceRateLimit = (
  request,
  response,
  {
    key,
    max = 20,
    windowMs = 60_000,
  },
) => {
  const now = Date.now();
  cleanExpiredBuckets(now);

  const ip = getRequestIp(request);
  const bucketKey = `${key}:${ip}`;
  const existing = RATE_BUCKETS.get(bucketKey);
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  RATE_BUCKETS.set(bucketKey, bucket);

  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  response.setHeader('Retry-After', String(retryAfterSec));

  if (bucket.count > max) {
    response.status(429).json({
      success: false,
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
    return false;
  }

  return true;
};

const parseCookies = (cookieHeader) => {
  const output = {};
  if (!cookieHeader) return output;

  const cookiePairs = String(cookieHeader).split(';');
  cookiePairs.forEach((cookie) => {
    const index = cookie.indexOf('=');
    if (index < 0) return;

    const key = cookie.slice(0, index).trim();
    const value = cookie.slice(index + 1).trim();
    if (!key) return;

    try {
      output[key] = decodeURIComponent(value);
    } catch {
      output[key] = value;
    }
  });

  return output;
};

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');
const decodeBase64Url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signSessionPayload = (encodedPayload, secret) => (
  crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
);

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createSessionToken = (payload, secret, ttlSeconds = SESSION_TTL_SECONDS) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encodedPayload = encodeBase64Url(JSON.stringify({ ...payload, exp }));
  const signature = signSessionPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const verifySessionToken = (token, secret) => {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = signSessionPayload(encodedPayload, secret);
  if (!safeCompare(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    const exp = Number(payload?.exp || 0);
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const shouldUseSecureCookie = (request) => getRequestProto(request) === 'https';

export const setSessionCookie = (request, response, token, ttlSeconds = SESSION_TTL_SECONDS) => {
  const segments = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${ttlSeconds}`,
  ];

  if (shouldUseSecureCookie(request)) {
    segments.push('Secure');
  }

  response.setHeader('Set-Cookie', segments.join('; '));
};

export const clearSessionCookie = (request, response) => {
  const segments = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];

  if (shouldUseSecureCookie(request)) {
    segments.push('Secure');
  }

  response.setHeader('Set-Cookie', segments.join('; '));
};

export const getSessionFromRequest = (request) => {
  const secret = process.env.API_SESSION_SECRET;
  if (!secret) return null;

  const cookies = parseCookies(request.headers?.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  const session = verifySessionToken(token, secret);
  if (!session || !session.uid || !session.nickname) {
    return null;
  }

  return session;
};

export const requireSession = (request, response, { adminOnly = false } = {}) => {
  const secret = process.env.API_SESSION_SECRET;
  if (!secret) {
    response.status(500).json({
      success: false,
      error: 'API_SESSION_SECRET 환경변수가 설정되지 않았습니다.',
    });
    return null;
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    response.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }

  if (adminOnly && session.isAdmin !== true) {
    response.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }

  return session;
};
