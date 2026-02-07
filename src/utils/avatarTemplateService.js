const COLOR_BY_TIME = {
    morning: { bgA: '#FFD166', bgB: '#F4A261', cloth: '#3A86FF' },
    afternoon: { bgA: '#A8E6A3', bgB: '#79C2A7', cloth: '#2A9D8F' },
    evening: { bgA: '#CDB4FF', bgB: '#FFAFCC', cloth: '#6D597A' },
    night: { bgA: '#4B5D9A', bgB: '#1F2A44', cloth: '#2B2D42' }
};

const SKIN_TONES = ['#F3D3B2', '#E7BE98', '#D9A67D', '#C58B63', '#AA7656'];
const HAIR_COLORS = ['#1F1F1F', '#3B2F2F', '#5C4033', '#7B4F2A', '#2E2A47', '#8C5E3C'];

const GENDER_STYLES = {
    male: ['short', 'side', 'crop'],
    female: ['bob', 'long', 'pony'],
    other: ['wave', 'short', 'bob']
};

const EXPRESSION_BY_FEELING = {
    citrus: { eyeScale: 1.0, smile: 1.0, brow: -4 },
    chocolate: { eyeScale: 0.92, smile: 0.45, brow: -1 },
    mint: { eyeScale: 0.86, smile: 0.2, brow: 1 }
};

const ACCESSORY_BY_SUPERPOWER = {
    teleport: 'spark',
    invisible: 'halo',
    mindread: 'aura',
    fly: 'wind'
};

const hashString = (value) => {
    const source = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) >>> 0;
};

const mulberry32 = (seed) => {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

const pick = (array, random) => {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[Math.floor(random() * array.length)];
};

const escapeXml = (text) => {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

const hairSvg = (style, color) => {
    switch (style) {
        case 'side':
            return `<path d="M154 224c8-56 44-94 102-94 33 0 60 12 80 34 12 12 18 30 21 48-18-14-40-22-64-22-48 0-88 26-139 34z" fill="${color}" />`;
        case 'crop':
            return `<path d="M160 224c0-46 36-84 94-84 63 0 103 34 103 84-19-15-39-24-63-24-44 0-83 18-134 24z" fill="${color}" />`;
        case 'bob':
            return `<path d="M146 228c6-62 50-102 111-102 62 0 106 40 111 102-8 30-20 44-36 44 2-18 2-33-2-45-9-27-34-44-73-44-38 0-63 17-72 44-4 12-4 27-2 45-16 0-28-14-37-44z" fill="${color}" />`;
        case 'long':
            return `<path d="M144 232c2-63 47-106 112-106 64 0 109 43 111 106 2 66-6 114-34 114 4-23 5-42 1-56-8-30-33-49-78-49s-70 19-78 49c-4 14-3 33 1 56-28 0-36-48-35-114z" fill="${color}" />`;
        case 'pony':
            return `<path d="M152 228c6-61 49-100 104-100 52 0 92 30 105 80 11 10 16 23 16 40-17-6-34-9-53-10-15-29-39-44-68-44-36 0-66 15-87 44-20 1-38 5-57 12 0-8 1-15 3-22 6-2 12-2 19 0 2-22 8-41 18-56z" fill="${color}" />`;
        case 'wave':
            return `<path d="M146 226c8-59 47-98 110-98 64 0 103 40 110 98-17-16-37-25-57-25-17 0-31 5-44 14-12-9-28-14-46-14-24 0-47 9-73 25z" fill="${color}" />`;
        case 'short':
        default:
            return `<path d="M158 224c5-52 42-90 99-90s95 38 100 90c-21-16-45-26-71-26-36 0-72 11-128 26z" fill="${color}" />`;
    }
};

const accessorySvg = (type, hue) => {
    if (type === 'halo') {
        return `<ellipse cx="256" cy="152" rx="76" ry="18" fill="none" stroke="${hue}" stroke-width="6" opacity="0.55" />`;
    }
    if (type === 'aura') {
        return `<circle cx="256" cy="250" r="138" fill="none" stroke="${hue}" stroke-width="8" opacity="0.24" />`;
    }
    if (type === 'wind') {
        return `<path d="M98 288c56 0 58-16 96-16s39 16 77 16 39-16 77-16 39 16 77 16" fill="none" stroke="${hue}" stroke-width="8" opacity="0.28" stroke-linecap="round" />`;
    }
    return `<g opacity="0.35" fill="${hue}"><circle cx="152" cy="146" r="7"/><circle cx="360" cy="162" r="6"/><circle cx="338" cy="112" r="5"/><circle cx="184" cy="102" r="4"/></g>`;
};

const buildAvatarSvg = ({ nickname, employeeId, gender, personality }) => {
    const identitySeed = hashString(`${employeeId || ''}|${nickname || ''}|${gender || ''}`);
    const random = mulberry32(identitySeed || 1);

    const timePalette = COLOR_BY_TIME[personality?.time] || COLOR_BY_TIME.morning;
    const expression = EXPRESSION_BY_FEELING[personality?.feeling] || EXPRESSION_BY_FEELING.citrus;
    const hairStyle = pick(GENDER_STYLES[gender] || GENDER_STYLES.other, random) || 'short';
    const skin = pick(SKIN_TONES, random);
    const hair = pick(HAIR_COLORS, random);
    const iris = pick(['#3A86FF', '#2A9D8F', '#6C5CE7', '#4C6E91', '#6D6875'], random);
    const accessory = ACCESSORY_BY_SUPERPOWER[personality?.superpower] || 'spark';
    const accessoryHue = pick(['#B5179E', '#4361EE', '#2EC4B6', '#FB8500'], random);

    const smileDepth = (10 * expression.smile).toFixed(2);
    const browOffset = expression.brow;
    const eyeRy = (12 * expression.eyeScale).toFixed(2);

    const faceId = `avatar-face-${identitySeed}`;
    const desc = `${nickname || 'user'} single character avatar`;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Profile Avatar</title>
  <desc id="desc">${escapeXml(desc)}</desc>
  <defs>
    <linearGradient id="bgGrad-${identitySeed}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${timePalette.bgA}" />
      <stop offset="100%" stop-color="${timePalette.bgB}" />
    </linearGradient>
    <radialGradient id="${faceId}" cx="50%" cy="38%" r="68%">
      <stop offset="0%" stop-color="${skin}" />
      <stop offset="100%" stop-color="${skin}" />
    </radialGradient>
  </defs>

  <rect width="512" height="512" fill="url(#bgGrad-${identitySeed})" />
  <circle cx="256" cy="242" r="188" fill="#ffffff20" />

  ${accessorySvg(accessory, accessoryHue)}

  <ellipse cx="256" cy="430" rx="152" ry="90" fill="${timePalette.cloth}" />
  <path d="M176 434c24-46 58-70 80-70s56 24 80 70" fill="#ffffff1a" />
  <rect x="230" y="292" width="52" height="58" rx="18" fill="${skin}" />
  <ellipse cx="256" cy="252" rx="98" ry="118" fill="url(#${faceId})" />
  <circle cx="158" cy="252" r="18" fill="${skin}" />
  <circle cx="354" cy="252" r="18" fill="${skin}" />

  ${hairSvg(hairStyle, hair)}

  <ellipse cx="220" cy="246" rx="12" ry="${eyeRy}" fill="#fff" />
  <ellipse cx="292" cy="246" rx="12" ry="${eyeRy}" fill="#fff" />
  <circle cx="220" cy="248" r="6" fill="${iris}" />
  <circle cx="292" cy="248" r="6" fill="${iris}" />
  <circle cx="222" cy="246" r="2" fill="#fff" />
  <circle cx="294" cy="246" r="2" fill="#fff" />

  <path d="M204 ${220 + browOffset}q16-10 32 0" stroke="#2b2b2b" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M276 ${220 + browOffset}q16-10 32 0" stroke="#2b2b2b" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M256 262q-6 12 0 20" stroke="#8b5a44" stroke-width="3" fill="none" stroke-linecap="round" />
  <path d="M220 302q36 ${smileDepth} 72 0" stroke="#9b3d3d" stroke-width="5" fill="none" stroke-linecap="round" />
</svg>`.trim();
};

export const generateTemplateAvatar = async (profileInput) => {
    try {
        const payload = {
            nickname: profileInput?.nickname || '',
            employeeId: profileInput?.employeeId || '',
            gender: profileInput?.gender || 'other',
            personality: profileInput?.personality || {}
        };

        const svg = buildAvatarSvg(payload);
        const imageData = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
        const meta = {
            provider: 'template-avatar',
            gender: payload.gender,
            employeeId: payload.employeeId || null
        };

        return {
            success: true,
            imageData,
            prompt: JSON.stringify(meta)
        };
    } catch (error) {
        console.error('Template avatar generation error:', error);
        return {
            success: false,
            error: error?.message || '아바타 생성 중 오류가 발생했습니다.'
        };
    }
};

export default {
    generateTemplateAvatar
};
