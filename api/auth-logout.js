import { applyCors, clearSessionCookie } from './_security.js';

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  clearSessionCookie(request, response);
  response.status(200).json({ success: true });
}
