/* global process */
import { handleUpload } from '@vercel/blob/client';
import { createClient } from '@supabase/supabase-js';
import {
  applyCors,
  enforceRateLimit,
  getSessionFromRequest,
  parseRequestBody,
} from '../_security.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const getBlobReadWriteToken = () => (
  process.env.BLOB_READ_WRITE_TOKEN || process.env.SPACED_BLOB_READ_WRITE_TOKEN
);

const parseClientPayload = (clientPayload) => {
  if (!clientPayload) return {};

  try {
    return JSON.parse(clientPayload);
  } catch {
    return {};
  }
};

const getBearerToken = (request) => {
  const header = String(request.headers?.authorization || request.headers?.Authorization || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
};

const getSupabaseAuthSession = async (request) => {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Auth 검증 환경변수가 설정되지 않았습니다.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  return {
    uid: data.user.id,
    nickname: data.user.user_metadata?.nickname || data.user.email || 'user',
    isAdmin: false,
  };
};

const getVerifiedUploadSession = async (request) => {
  const cookieSession = getSessionFromRequest(request);
  if (cookieSession) return cookieSession;

  return await getSupabaseAuthSession(request);
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  let session = null;
  try {
    session = await getVerifiedUploadSession(request);
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '인증 정보를 확인하지 못했습니다.',
    });
    return;
  }

  if (!session) {
    response.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (!enforceRateLimit(request, response, { key: `feed-blob-upload:${session.uid}`, max: 20, windowMs: 60_000 })) {
    return;
  }

  const blobReadWriteToken = getBlobReadWriteToken();
  if (!blobReadWriteToken) {
    response.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN 또는 SPACED_BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' });
    return;
  }

  try {
    const body = parseRequestBody(request);
    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobReadWriteToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        if (!payload.userId || String(payload.userId) !== String(session.uid)) {
          throw new Error('업로드 권한을 확인할 수 없습니다.');
        }

        if (!String(pathname || '').startsWith(`feed/${session.uid}/`)) {
          throw new Error('허용되지 않은 업로드 경로입니다.');
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: session.uid,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('feed blob upload completed', {
          pathname: blob.pathname,
          userId: parseClientPayload(tokenPayload).userId,
        });
      },
    });

    response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Feed blob upload error:', error);
    response.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.',
    });
  }
}
