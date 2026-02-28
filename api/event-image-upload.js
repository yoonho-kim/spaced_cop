/* global process, Buffer */
import { put } from '@vercel/blob';
import {
  applyCors,
  enforceRateLimit,
  parseRequestBody,
  requireSession,
} from './_security.js';

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

  if (!enforceRateLimit(request, response, { key: `event-image-upload:${session.uid}`, max: 10, windowMs: 60_000 })) {
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    response.status(500).json({ success: false, error: 'BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.' });
    return;
  }

  try {
    const { fileName, fileType, fileBase64 } = parseRequestBody(request);

    if (!fileName || !fileType || !fileBase64) {
      response.status(400).json({ success: false, error: '이미지 업로드 요청이 올바르지 않습니다.' });
      return;
    }

    if (!fileType.startsWith('image/')) {
      response.status(400).json({ success: false, error: '이미지 파일만 업로드할 수 있습니다.' });
      return;
    }

    const safeName = String(fileName).replace(/[^\w.-]+/g, '-').slice(0, 80);
    const base64Payload = String(fileBase64).includes(',')
      ? String(fileBase64).split(',')[1]
      : String(fileBase64);
    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      response.status(413).json({ success: false, error: '이미지 크기는 3MB 이하만 업로드할 수 있습니다.' });
      return;
    }
    const pathname = `event_img/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: fileType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });

    response.status(200).json({
      success: true,
      publicUrl: blob.url,
      path: blob.url,
    });
  } catch (error) {
    console.error('Error uploading event image to Vercel Blob:', error);
    response.status(500).json({ success: false, error: '이미지 업로드에 실패했습니다.' });
  }
}
