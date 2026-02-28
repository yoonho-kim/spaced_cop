/* global process */
import { applyCors, enforceRateLimit, parseRequestBody, requireSession } from './_security.js';

const MODEL_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const session = requireSession(request, response);
  if (!session) return;

  if (!enforceRateLimit(request, response, { key: `gemini:${session.uid}`, max: 15, windowMs: 60_000 })) {
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured' });
    return;
  }

  const { model, body } = parseRequestBody(request);
  const modelName = String(model || '').trim();

  if (!modelName || !MODEL_ID_REGEX.test(modelName) || typeof body !== 'object' || body == null) {
    response.status(400).json({
      success: false,
      error: 'Invalid request payload',
    });
    return;
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    const data = await geminiResponse.json().catch(() => ({}));
    response.status(geminiResponse.status).json(data);
  } catch (error) {
    console.error('Gemini Proxy Error:', error);
    response.status(500).json({
      success: false,
      error: 'Gemini 요청 처리 중 오류가 발생했습니다.',
    });
  }
}
