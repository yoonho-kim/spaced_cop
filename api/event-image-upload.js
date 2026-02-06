import { put } from '@vercel/blob';

const setCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
};

const parseRequestBody = (request) => {
  if (!request?.body) return {};
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
};

export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
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

    const safeName = String(fileName).replace(/[^\w.-]+/g, '-');
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
