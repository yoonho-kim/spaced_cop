const RAW_URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.!?:;\]}]+$/;

const trimTrailingPunctuation = (value) => {
  let nextValue = String(value || '').trim();

  while (TRAILING_PUNCTUATION_REGEX.test(nextValue)) {
    nextValue = nextValue.replace(TRAILING_PUNCTUATION_REGEX, '');
  }

  return nextValue;
};

export const normalizeUrl = (value) => {
  const trimmedValue = trimTrailingPunctuation(value);
  if (!trimmedValue) return '';

  try {
    const parsed = new URL(trimmedValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

export const extractUrls = (text) => {
  const source = String(text || '');
  const matches = source.match(RAW_URL_REGEX) || [];
  const uniqueUrls = [];
  const seen = new Set();

  matches.forEach((match) => {
    const normalized = normalizeUrl(match);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    uniqueUrls.push(normalized);
  });

  return uniqueUrls;
};

export const getFirstUrl = (text) => extractUrls(text)[0] || '';

export const splitTextWithUrls = (text) => {
  const source = String(text || '');
  if (!source) return [];

  const parts = [];
  let cursor = 0;
  let match;

  RAW_URL_REGEX.lastIndex = 0;

  while ((match = RAW_URL_REGEX.exec(source)) !== null) {
    const rawMatch = match[0];
    const normalized = normalizeUrl(rawMatch);
    const rawStart = match.index;
    const normalizedLength = normalized ? rawMatch.length - (rawMatch.length - trimTrailingPunctuation(rawMatch).length) : rawMatch.length;
    const rawEnd = rawStart + normalizedLength;

    if (rawStart > cursor) {
      parts.push({
        type: 'text',
        value: source.slice(cursor, rawStart),
      });
    }

    if (normalized) {
      parts.push({
        type: 'link',
        value: source.slice(rawStart, rawEnd),
        url: normalized,
      });
      if (rawEnd < rawStart + rawMatch.length) {
        parts.push({
          type: 'text',
          value: source.slice(rawEnd, rawStart + rawMatch.length),
        });
      }
    } else {
      parts.push({
        type: 'text',
        value: rawMatch,
      });
    }

    cursor = rawStart + rawMatch.length;
  }

  if (cursor < source.length) {
    parts.push({
      type: 'text',
      value: source.slice(cursor),
    });
  }

  return parts;
};

export const getHostnameFromUrl = (url) => {
  const normalized = normalizeUrl(url);
  if (!normalized) return '';

  try {
    return new URL(normalized).hostname;
  } catch {
    return '';
  }
};

export const fetchLinkPreview = async (url, { signal } = {}) => {
  const targetUrl = normalizeUrl(url);
  if (!targetUrl) {
    throw new Error('유효한 URL이 아닙니다.');
  }

  const response = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`, {
    method: 'GET',
    credentials: 'include',
    signal,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || '링크 미리보기를 불러오지 못했습니다.');
  }

  return result.preview;
};
