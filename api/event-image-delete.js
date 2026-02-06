import { del } from '@vercel/blob';

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
    const { path } = parseRequestBody(request);
    if (!path) {
      response.status(200).json({ success: true });
      return;
    }

    const pathString = String(path);
    if (!pathString.includes('.blob.vercel-storage.com/')) {
      // Supabase 경로 등 이전 데이터는 Blob 삭제 대상이 아니므로 무시
      response.status(200).json({ success: true, skipped: true });
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
