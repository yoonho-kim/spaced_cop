import { applyCors, enforceRateLimit, requireSession } from './_security.js';

const REQUEST_TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 3;
const MAX_HTML_LENGTH = 200_000;
const HTML_ACCEPT_HEADER = 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.6,*/*;q=0.2';
const USER_AGENT = 'SpacedLinkPreviewBot/1.0';
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost'];
const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const ATTR_REGEX = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, '\'')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const collapseWhitespace = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const stripTags = (value) => collapseWhitespace(String(value || '').replace(/<[^>]+>/g, ' '));

const normalizeText = (value, maxLength = 320) => {
  const cleaned = collapseWhitespace(decodeHtmlEntities(stripTags(value)));
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
};

const resolveAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
};

const getTitleFromUrl = (url) => {
  const pathSegment = url.pathname.split('/').filter(Boolean).pop();
  if (!pathSegment) return url.hostname;

  let decodedSegment = pathSegment;
  try {
    decodedSegment = decodeURIComponent(pathSegment);
  } catch {
    decodedSegment = pathSegment;
  }

  decodedSegment = decodedSegment.replace(/[-_]+/g, ' ');
  return normalizeText(decodedSegment, 120) || url.hostname;
};

const isPrivateIpv4 = (hostname) => {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
};

const isBlockedIpv6 = (hostname) => {
  const normalized = String(hostname || '').toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:');
};

const isSafePublicUrl = (candidate) => {
  let parsed;

  try {
    parsed = new URL(String(candidate || '').trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTS.has(hostname)) {
    return false;
  }

  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return false;
  }

  if (!hostname.includes('.') && !hostname.includes(':')) {
    return false;
  }

  if (isPrivateIpv4(hostname) || isBlockedIpv6(hostname)) {
    return false;
  }

  return true;
};

const parseAttributes = (tag) => {
  const attributes = {};
  let match;

  ATTR_REGEX.lastIndex = 0;

  while ((match = ATTR_REGEX.exec(tag)) !== null) {
    const [, rawName, , doubleQuoted, singleQuoted, bareValue] = match;
    attributes[String(rawName || '').toLowerCase()] = decodeHtmlEntities(
      doubleQuoted ?? singleQuoted ?? bareValue ?? '',
    );
  }

  return attributes;
};

const findMetaContent = (html, names) => {
  const targets = new Set(names.map((name) => String(name || '').toLowerCase()));
  const metaTags = String(html || '').match(META_TAG_REGEX) || [];

  for (const tag of metaTags) {
    const attributes = parseAttributes(tag);
    const metaName = String(attributes.property || attributes.name || '').toLowerCase();
    if (!metaName || !targets.has(metaName)) continue;

    const content = collapseWhitespace(attributes.content || '');
    if (content) return content;
  }

  return '';
};

const extractPreviewFromHtml = (html, finalUrl) => {
  const safeHtml = String(html || '').slice(0, MAX_HTML_LENGTH);
  const titleMatch = safeHtml.match(TITLE_REGEX);
  const rawTitle = findMetaContent(safeHtml, ['og:title', 'twitter:title']) || (titleMatch ? titleMatch[1] : '');
  const rawDescription = findMetaContent(safeHtml, ['og:description', 'twitter:description', 'description']);
  const rawImage = findMetaContent(safeHtml, ['og:image', 'twitter:image']);
  const rawSiteName = findMetaContent(safeHtml, ['og:site_name', 'application-name']);
  const rawCanonicalUrl = findMetaContent(safeHtml, ['og:url']);
  const resolvedImageUrl = resolveAbsoluteUrl(rawImage, finalUrl);
  const canonicalUrl = resolveAbsoluteUrl(rawCanonicalUrl, finalUrl) || finalUrl.toString();

  return {
    url: canonicalUrl,
    title: normalizeText(rawTitle, 140) || getTitleFromUrl(finalUrl),
    description: normalizeText(rawDescription, 220),
    imageUrl: resolvedImageUrl,
    siteName: normalizeText(rawSiteName, 80) || finalUrl.hostname,
    hostname: finalUrl.hostname,
  };
};

const fetchHtmlWithRedirects = async (inputUrl) => {
  let currentUrl = new URL(inputUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isSafePublicUrl(currentUrl.toString())) {
      throw new Error('지원하지 않는 링크입니다.');
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: abortController.signal,
        headers: {
          Accept: HTML_ACCEPT_HEADER,
          'User-Agent': USER_AGENT,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('리디렉션 대상이 올바르지 않습니다.');
      }

      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`링크 응답을 가져오지 못했습니다. (${response.status})`);
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {
        url: currentUrl.toString(),
        title: getTitleFromUrl(currentUrl),
        description: '',
        imageUrl: null,
        siteName: currentUrl.hostname,
        hostname: currentUrl.hostname,
      };
    }

    const html = await response.text();
    return extractPreviewFromHtml(html, currentUrl);
  }

  throw new Error('리디렉션이 너무 많습니다.');
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'GET,OPTIONS' })) {
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const session = requireSession(request, response);
  if (!session) return;

  if (!enforceRateLimit(request, response, { key: `link-preview:${session.uid}`, max: 60, windowMs: 60_000 })) {
    return;
  }

  const rawUrl = String(request.query?.url || '').trim();
  if (!rawUrl || !isSafePublicUrl(rawUrl)) {
    response.status(400).json({ success: false, error: '미리보기를 지원하지 않는 링크입니다.' });
    return;
  }

  try {
    const preview = await fetchHtmlWithRedirects(rawUrl);
    response.setHeader('Cache-Control', 'private, max-age=600');
    response.status(200).json({ success: true, preview });
  } catch (error) {
    console.error('Link preview fetch error:', error);
    response.status(502).json({
      success: false,
      error: '링크 미리보기를 불러오지 못했습니다.',
    });
  }
}
