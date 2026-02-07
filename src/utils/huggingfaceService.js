/**
 * Hugging Face Inference API Service
 * 캐릭터 프로필 아이콘 생성
 */

const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;
const MODEL_URL = '/api/huggingface';

const MODEL_CANDIDATES = [
    'Lykon/dreamshaper-xl-lightning',
    'stabilityai/stable-diffusion-xl-base-1.0'
];

// 성향 질문 → 프롬프트 매핑
const PERSONALITY_MAPPINGS = {
    time: {
        morning: { colors: 'warm yellow and orange tones', mood: 'bright and energetic' },
        afternoon: { colors: 'soft green and beige tones', mood: 'calm and relaxed' },
        evening: { colors: 'purple and pink gradient', mood: 'emotional and dreamy' },
        night: { colors: 'deep navy blue and black', mood: 'mysterious and quiet' }
    },
    feeling: {
        citrus: { style: 'vibrant and crisp details', texture: 'fresh and zesty' },
        chocolate: { style: 'soft organic lines', texture: 'warm and smooth' },
        mint: { style: 'minimal clean aesthetic', texture: 'cool and sharp' }
    },
    place: {
        city: { background: 'abstract modern city skyline', atmosphere: 'urban and sophisticated' },
        forest: { background: 'stylized nature with lush trees', atmosphere: 'peaceful and natural' },
        beach: { background: 'gentle ocean waves and sunny beach', atmosphere: 'refreshing and sunny' },
        space: { background: 'magic cosmic nebula and stars', atmosphere: 'infinite and wondrous' }
    },
    animal: {
        cat: { trait: 'elegant and independent look', vibe: 'graceful' },
        dog: { trait: 'friendly and active energetic look', vibe: 'cheerful' },
        owl: { trait: 'wise and mysterious calm look', vibe: 'thoughtful' },
        dolphin: { trait: 'flexible and social outgoing look', vibe: 'playful' }
    },
    superpower: {
        teleport: { effect: 'dynamic particles and motion blur', energy: 'high energy' },
        invisible: { effect: 'ethereal transparency and subtle glows', energy: 'mystical' },
        mindread: { effect: 'deep thoughtful gaze with aura', energy: 'spiritual' },
        fly: { effect: 'lightness and wind wisps', energy: 'dreamy' }
    },
    snack: {
        coffee: { detail: 'concentrated and focused expression', finish: 'clean and modern' },
        chips: { detail: 'joyful and fun expression', finish: 'bright and lively' },
        fruit: { detail: 'refreshing and healthy glow', finish: 'clear and pure' },
        chocolate: { detail: 'sweet and comforting expression', finish: 'warm and cozy' }
    }
};

const GENDER_MAPPINGS = {
    male: {
        subject: 'adult male office worker',
        cue: 'male, man, masculine facial features',
        negative: 'female, woman, girl, feminine face, heavy makeup'
    },
    female: {
        subject: 'adult female office worker',
        cue: 'female, woman, feminine facial features',
        negative: 'male, man, boy, masculine jawline, beard stubble'
    },
    other: {
        subject: 'adult office worker',
        cue: 'androgynous adult person',
        negative: ''
    }
};

const toSafeText = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9가-힣_-]/g, '');

const normalizeProfileInput = (input) => {
    if (input && typeof input === 'object' && ('personality' in input || 'gender' in input || 'nickname' in input || 'employeeId' in input)) {
        return {
            personality: input.personality || {},
            gender: input.gender || '',
            nickname: input.nickname || '',
            employeeId: input.employeeId || ''
        };
    }

    return {
        personality: input || {},
        gender: '',
        nickname: '',
        employeeId: ''
    };
};

const buildIdentitySeed = ({ employeeId, nickname }) => {
    const identitySource = `${toSafeText(employeeId)}|${toSafeText(nickname)}` || 'default';
    let hash = 2166136261;
    for (let i = 0; i < identitySource.length; i += 1) {
        hash ^= identitySource.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const normalized = Math.abs(hash) % 2147483646;
    return normalized + 1;
};

const buildGenerationSpec = (profileInput, strictness = 0) => {
    const { personality: p, gender, nickname, employeeId } = normalizeProfileInput(profileInput);
    const t = PERSONALITY_MAPPINGS.time[p.time] || PERSONALITY_MAPPINGS.time.morning;
    const f = PERSONALITY_MAPPINGS.feeling[p.feeling] || PERSONALITY_MAPPINGS.feeling.citrus;
    const pl = PERSONALITY_MAPPINGS.place[p.place] || PERSONALITY_MAPPINGS.place.city;
    const a = PERSONALITY_MAPPINGS.animal[p.animal] || PERSONALITY_MAPPINGS.animal.cat;
    const s = PERSONALITY_MAPPINGS.superpower[p.superpower] || PERSONALITY_MAPPINGS.superpower.teleport;
    const sn = PERSONALITY_MAPPINGS.snack[p.snack] || PERSONALITY_MAPPINGS.snack.coffee;
    const genderGuide = GENDER_MAPPINGS[gender] || GENDER_MAPPINGS.other;

    const safeNickname = toSafeText(nickname);
    const safeEmployeeId = toSafeText(employeeId);
    const identityHint = [safeEmployeeId ? `employee-${safeEmployeeId}` : '', safeNickname ? `name-${safeNickname}` : '']
        .filter(Boolean)
        .join(', ');

    const repeatSingle = Array.from({ length: Math.max(2, strictness + 2) }, () => 'single character, one person only, one face only, one frame only').join(', ');
    const repeatGender = Array.from({ length: Math.max(1, strictness + 1) }, () => genderGuide.cue).join(', ');

    const prompt = `Disney Pixar inspired high-quality character portrait for profile icon.
${repeatSingle}.
bust shot composition, centered portrait, front-facing, clean background, no text.
subject: ${genderGuide.subject}, ${repeatGender}.
personality cues: ${a.trait}, ${sn.detail}, ${f.style}, ${f.texture}, ${s.effect}.
mood and palette: ${t.mood}, ${t.colors}, background atmosphere inspired by ${pl.atmosphere} and ${pl.background}.
style: polished 3d character illustration, expressive face, cinematic soft lighting, detailed and consistent.
identity hint: ${identityHint || 'employee-default'}.
strict rule: exactly one face in image, no collage, no split panel, no grid, no duplicate character.`
        .replace(/\s+/g, ' ')
        .trim();

    const negativePrompt = [
        'real photo',
        'photorealistic',
        'painting',
        'sketch',
        'chibi',
        'flat icon',
        'emoji',
        'grid',
        'collage',
        'mosaic',
        '2x2',
        '3x3',
        '4-panel',
        'quadrants',
        'sprite sheet',
        'sticker sheet',
        'contact sheet',
        'character sheet',
        'split screen',
        'multiple portraits',
        'multiple people',
        'group',
        'crowd',
        'couple',
        'duplicate face',
        'two faces',
        'many faces',
        'text',
        'logo',
        'watermark',
        'blurry',
        'low quality',
        'bad anatomy',
        'deformed face',
        genderGuide.negative
    ].filter(Boolean).join(', ');

    return {
        prompt,
        negativePrompt,
        seed: buildIdentitySeed({ employeeId, nickname }) + strictness * 101,
        guidanceScale: Math.min(13, 10.5 + strictness * 0.7)
    };
};

const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const loadImageFromBlob = (blob) => {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = (error) => {
            URL.revokeObjectURL(url);
            reject(error);
        };
        image.src = url;
    });
};

const canvasToBlob = (canvas) => {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('이미지 후처리에 실패했습니다.'));
                return;
            }
            resolve(blob);
        }, 'image/png');
    });
};

const calcAdjacentDiff = (data, width, height, axis, line) => {
    let sum = 0;
    let count = 0;
    const step = 2;

    if (axis === 'x') {
        const x = Math.max(0, Math.min(width - 2, line));
        for (let y = 0; y < height; y += step) {
            const idx1 = (y * width + x) * 4;
            const idx2 = (y * width + (x + 1)) * 4;
            sum += Math.abs(data[idx1] - data[idx2]);
            sum += Math.abs(data[idx1 + 1] - data[idx2 + 1]);
            sum += Math.abs(data[idx1 + 2] - data[idx2 + 2]);
            count += 1;
        }
    } else {
        const y = Math.max(0, Math.min(height - 2, line));
        for (let x = 0; x < width; x += step) {
            const idx1 = (y * width + x) * 4;
            const idx2 = ((y + 1) * width + x) * 4;
            sum += Math.abs(data[idx1] - data[idx2]);
            sum += Math.abs(data[idx1 + 1] - data[idx2 + 1]);
            sum += Math.abs(data[idx1 + 2] - data[idx2 + 2]);
            count += 1;
        }
    }

    return count > 0 ? sum / (count * 3) : 0;
};

const calcGlobalAdjacentDiff = (data, width, height, axis) => {
    let sum = 0;
    let count = 0;
    const step = 8;

    if (axis === 'x') {
        for (let x = 0; x < width - 1; x += step) {
            sum += calcAdjacentDiff(data, width, height, axis, x);
            count += 1;
        }
    } else {
        for (let y = 0; y < height - 1; y += step) {
            sum += calcAdjacentDiff(data, width, height, axis, y);
            count += 1;
        }
    }

    return count > 0 ? sum / count : 0;
};

const detectGridCount = (data, width, height) => {
    const globalX = calcGlobalAdjacentDiff(data, width, height, 'x');
    const globalY = calcGlobalAdjacentDiff(data, width, height, 'y');
    const candidates = [2, 3, 4];

    for (const n of candidates) {
        const seamX = [];
        const seamY = [];
        for (let k = 1; k < n; k += 1) {
            seamX.push(calcAdjacentDiff(data, width, height, 'x', Math.round((width * k) / n)));
            seamY.push(calcAdjacentDiff(data, width, height, 'y', Math.round((height * k) / n)));
        }

        const avgSeamX = seamX.reduce((acc, value) => acc + value, 0) / Math.max(1, seamX.length);
        const avgSeamY = seamY.reduce((acc, value) => acc + value, 0) / Math.max(1, seamY.length);
        const ratioX = avgSeamX / Math.max(1, globalX);
        const ratioY = avgSeamY / Math.max(1, globalY);

        if (ratioX > 1.65 && ratioY > 1.65 && avgSeamX > 14 && avgSeamY > 14) {
            return n;
        }
    }

    return null;
};

const pickGridTile = (gridCount, seed) => {
    if (gridCount % 2 === 1) {
        const mid = Math.floor(gridCount / 2);
        return { col: mid, row: mid };
    }

    const totalTiles = gridCount * gridCount;
    const tileIndex = seed % totalTiles;
    return {
        row: Math.floor(tileIndex / gridCount),
        col: tileIndex % gridCount
    };
};

const cropGridTile = async (image, gridCount, tile) => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const tileWidth = Math.round(sourceWidth / gridCount);
    const tileHeight = Math.round(sourceHeight / gridCount);
    const sourceX = tile.col * tileWidth;
    const sourceY = tile.row * tileHeight;

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        tileWidth,
        tileHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
    );

    return canvasToBlob(canvas);
};

const cropCenterFocus = async (image, ratio = 0.84, yBias = -0.05) => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const safeRatio = Math.max(0.55, Math.min(1, ratio));
    const cropWidth = Math.round(sourceWidth * safeRatio);
    const cropHeight = Math.round(sourceHeight * safeRatio);
    const sourceX = Math.round(sourceWidth / 2 - cropWidth / 2);
    const rawSourceY = Math.round(sourceHeight / 2 - cropHeight / 2 + sourceHeight * yBias);
    const sourceY = Math.max(0, Math.min(sourceHeight - cropHeight, rawSourceY));

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
    );

    return canvasToBlob(canvas);
};

const enforceSingleCharacterPortrait = async (imageBlob, seed = 1) => {
    try {
        const originalImage = await loadImageFromBlob(imageBlob);
        const width = originalImage.naturalWidth || originalImage.width;
        const height = originalImage.naturalHeight || originalImage.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return imageBlob;

        ctx.drawImage(originalImage, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const gridCount = detectGridCount(imageData.data, width, height);

        let workingBlob = imageBlob;
        let workingImage = originalImage;

        if (gridCount) {
            const tile = pickGridTile(gridCount, seed);
            const croppedTile = await cropGridTile(originalImage, gridCount, tile);
            if (croppedTile) {
                workingBlob = croppedTile;
                workingImage = await loadImageFromBlob(croppedTile);
            }
        }

        const focusedBlob = await cropCenterFocus(
            workingImage,
            gridCount ? 0.9 : 0.84,
            gridCount ? -0.04 : -0.05
        );

        return focusedBlob || workingBlob;
    } catch (error) {
        console.warn('single portrait post-process skipped:', error);
        return imageBlob;
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 성향 데이터를 기반으로 AI 프롬프트 생성
 * 입력: personality 또는 { personality, gender, nickname, employeeId }
 */
export const generatePrompt = (profileInput) => {
    return buildGenerationSpec(profileInput).prompt;
};

/**
 * 프로필 아이콘 생성
 * @param {Object} profileInput - personality 또는 { personality, gender, nickname, employeeId }
 * @returns {Promise<{ success: boolean, imageData?: string, prompt?: string, error?: string }>}
 */
export const generateProfileIcon = async (profileInput, options = {}) => {
    try {
        const strictness = Number(options.strictness || 0);
        const model = options.model || MODEL_CANDIDATES[0];
        const spec = buildGenerationSpec(profileInput, strictness);

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                inputs: spec.prompt,
                parameters: {
                    negative_prompt: spec.negativePrompt,
                    num_inference_steps: 50,
                    guidance_scale: spec.guidanceScale,
                    width: 512,
                    height: 512,
                    seed: spec.seed
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hugging Face API Error:', errorText);

            if (response.status === 503) {
                return {
                    success: false,
                    error: '모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
                    status: 503,
                    isLoading: true
                };
            }

            return {
                success: false,
                error: `아이콘 생성 실패: ${response.status}`,
                status: response.status
            };
        }

        const imageBlob = await response.blob();
        const processedBlob = await enforceSingleCharacterPortrait(imageBlob, spec.seed);
        const base64 = await blobToBase64(processedBlob);

        return {
            success: true,
            imageData: base64,
            prompt: `${spec.prompt}\nmodel:${model}`
        };
    } catch (error) {
        console.error('Error generating profile icon:', error);
        return {
            success: false,
            error: error.message || '아이콘 생성 중 오류가 발생했습니다.'
        };
    }
};

/**
 * 재시도 로직이 포함된 아이콘 생성
 */
export const generateProfileIconWithRetry = async (profileInput, maxRetries = 5) => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        const model = MODEL_CANDIDATES[(attempt - 1) % MODEL_CANDIDATES.length];
        const result = await generateProfileIcon(profileInput, {
            strictness: attempt - 1,
            model
        });

        if (result.success) {
            return result;
        }

        lastError = result;

        if (result.isLoading && attempt < maxRetries) {
            await sleep(2500 * attempt);
            continue;
        }
    }

    return {
        success: false,
        error: lastError?.error || '아이콘 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
    };
};

export default {
    generateProfileIcon,
    generateProfileIconWithRetry,
    generatePrompt
};
