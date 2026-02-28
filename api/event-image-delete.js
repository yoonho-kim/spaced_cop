/* global process */
import { del } from '@vercel/blob';
import {
  applyCors,
  enforceRateLimit,
  parseRequestBody,
  requireSession,
} from './_security.js';

const isAllowedEventBlobPath = (value) => {
  if (!value) return false;

  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.endsWith('.blob.vercel-storage.com')) return false;

    const normalizedPath = parsed.pathname.replace(/^\/+/, '');
    if (!normalizedPath.startsWith('event_img/')) return false;
    if (normalizedPath.includes('..')) return false;

    return true;
  } catch {
    return false;
  }
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const session = requireSession(request, response, { adminOnly: true });
  if (!session) return;

  if (!enforceRateLimit(request, response, { key: `event-image-delete:${session.uid}`, max: 20, windowMs: 60_000 })) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    response.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' });
    return;
  }

  try {
    const { path } = parseRequestBody(request);
    if (!path) {
      response.status(200).json({ success: true });
      return;
    }

    const pathString = String(path);
    if (!isAllowedEventBlobPath(pathString)) {
      response.status(400).json({ success: false, error: '허용되지 않은 이미지 경로입니다.' });
      return;
    }

    await del(pathString, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    response.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting event image from Vercel Blob:', error);
    response.status(500).json({ success: false, error: '이미지 삭제에 실패했습니다.' });
  }
}
