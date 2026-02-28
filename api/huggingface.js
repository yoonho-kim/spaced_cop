/* global process, Buffer */
import {
  applyCors,
  enforceRateLimit,
  getSessionFromRequest,
  parseRequestBody,
} from './_security.js';

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';
const SIGNUP_PURPOSE = 'signup_profile_icon';
const MODEL_ID_REGEX = /^[\w.-]+\/[\w.-]+$/;

const toNumberInRange = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const sanitizeHfParameters = (raw, { signupMode = false } = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sanitized = {
    num_inference_steps: toNumberInRange(source.num_inference_steps, 1, 35, signupMode ? 6 : 20),
    width: 512,
    height: 512,
    seed: Math.trunc(toNumberInRange(source.seed, 1, 2_147_483_647, Math.floor(Math.random() * 100_000) + 1)),
  };

  if (!signupMode) {
    const guidanceScale = source.guidance_scale ?? source.guidanceScale;
    sanitized.guidance_scale = toNumberInRange(guidanceScale, 1, 20, 7.5);

    if (typeof source.negative_prompt === 'string') {
      sanitized.negative_prompt = source.negative_prompt.slice(0, 4000);
    }
  }

  return sanitized;
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
    return;
  }

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    response.status(500).json({ success: false, error: 'HUGGINGFACE_API_KEY is not configured' });
    return;
  }

  try {
    const requestBody = parseRequestBody(request);
    const session = getSessionFromRequest(request);
    const signupMode = !session && String(requestBody?.purpose || '').trim() === SIGNUP_PURPOSE;

    if (session) {
      if (!enforceRateLimit(request, response, { key: `huggingface:${session.uid}`, max: 8, windowMs: 60_000 })) {
        return;
      }
    } else {
      if (!signupMode) {
        response.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!enforceRateLimit(request, response, { key: 'huggingface-signup', max: 4, windowMs: 60_000 })) {
        return;
      }
    }

    const promptText = typeof requestBody.inputs === 'string' ? requestBody.inputs.trim() : '';
    if (!promptText) {
      response.status(400).json({ success: false, error: '이미지 프롬프트가 필요합니다.' });
      return;
    }
    if (promptText.length > 6000) {
      response.status(400).json({ success: false, error: '프롬프트 길이가 너무 깁니다.' });
      return;
    }

    const requestedModel = typeof requestBody.model === 'string' ? requestBody.model.trim() : '';
    let modelId = MODEL_ID_REGEX.test(requestedModel) ? requestedModel : DEFAULT_MODEL;
    if (signupMode) {
      modelId = DEFAULT_MODEL;
    }

    const modelUrl = `https://router.huggingface.co/hf-inference/models/${modelId}`;
    const forwardBody = {
      inputs: promptText,
      parameters: sanitizeHfParameters(requestBody.parameters, { signupMode }),
    };

    const hfResponse = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardBody),
    });

    if (!hfResponse.ok) {
      await hfResponse.text().catch(() => '');
      response.status(hfResponse.status).json({
        success: false,
        error: '이미지 생성 요청이 실패했습니다.',
      });
      return;
    }

    const arrayBuffer = await hfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    response.setHeader('Content-Type', hfResponse.headers.get('content-type') || 'image/jpeg');
    response.status(200).send(buffer);
  } catch (error) {
    console.error('Proxy Error:', error);
    response.status(500).json({
      success: false,
      error: '이미지 생성 요청 처리 중 오류가 발생했습니다.',
    });
  }
}
