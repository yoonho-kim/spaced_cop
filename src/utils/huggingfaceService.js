/**
 * Hugging Face Inference API Service
 * 인물 캐릭터 프로필 아이콘 생성
 */

const MODEL_URL = '/api/huggingface';
const DIRECT_MODEL_BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const MODEL_ID_REGEX = /^[\w.-]+\/[\w.-]+$/;

const MODEL_CANDIDATES = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-2-1'
];

const isDevMode = () => import.meta.env.DEV;

const getModelId = (model) => {
    const modelText = String(model || '').trim();
    return MODEL_ID_REGEX.test(modelText) ? modelText : MODEL_CANDIDATES[0];
};

const requestImageViaLocalApi = async (model, prompt, parameters) => {
    return fetch(MODEL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            model,
            purpose: 'signup_profile_icon',
            inputs: prompt,
            parameters
        })
    });
};

const requestImageViaDevDirectApi = async (model, prompt, parameters) => {
    if (!isDevMode()) return null;

    const devApiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY;
    if (!devApiKey) return null;

    const modelId = getModelId(model);
    const modelUrl = `${DIRECT_MODEL_BASE_URL}/${modelId}`;

    return fetch(modelUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${devApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters,
        }),
    });
};

// 성향 질문 → 증명사진 프롬프트 매핑 (스타일 보조용)
const PERSONALITY_MAPPINGS = {
    time: {
        morning: { lighting: 'daylight-balanced soft key light', mood: 'clean and energetic tone' },
        afternoon: { lighting: 'neutral softbox light', mood: 'calm and stable tone' },
        evening: { lighting: 'warm softbox light', mood: 'gentle and friendly tone' },
        night: { lighting: 'cool softbox light', mood: 'composed and serious tone' }
    },
    feeling: {
        citrus: { expression: 'slight confident smile', texture: 'crisp and polished styling' },
        chocolate: { expression: 'warm natural smile', texture: 'soft and approachable styling' },
        mint: { expression: 'neutral calm expression', texture: 'minimal and clean styling' }
    },
    place: {
        city: { backdrop: 'light gray seamless studio backdrop', atmosphere: 'professional and modern' },
        forest: { backdrop: 'soft sage seamless studio backdrop', atmosphere: 'calm and natural' },
        beach: { backdrop: 'bright sky-blue seamless studio backdrop', atmosphere: 'fresh and open' },
        space: { backdrop: 'deep navy seamless studio backdrop', atmosphere: 'focused and premium' }
    },
    animal: {
        cat: { trait: 'composed and confident eyes', vibe: 'elegant' },
        dog: { trait: 'friendly and open expression', vibe: 'cheerful' },
        owl: { trait: 'thoughtful and stable gaze', vibe: 'intellectual' },
        dolphin: { trait: 'bright and approachable expression', vibe: 'playful' }
    },
    superpower: {
        teleport: { posture: 'upright posture', energy: 'decisive and active mood' },
        invisible: { posture: 'stable posture', energy: 'quiet and clean mood' },
        mindread: { posture: 'balanced posture', energy: 'calm and analytical mood' },
        fly: { posture: 'light relaxed posture', energy: 'optimistic and airy mood' }
    },
    snack: {
        coffee: { detail: 'focused and reliable expression', finish: 'well-groomed professional finish' },
        chips: { detail: 'lively and bright expression', finish: 'clean and friendly finish' },
        fruit: { detail: 'fresh and healthy expression', finish: 'natural and neat finish' },
        chocolate: { detail: 'warm and kind expression', finish: 'soft and stable finish' }
    }
};

const GENDER_MAPPINGS = {
    male: {
        subject: 'adult East Asian man, office employee',
        cue: 'male, man, masculine face, masculine jawline, short male hairstyle',
        negative: 'female, woman, girl, feminine face, long feminine hairstyle, lipstick, eyelashes, heavy makeup'
    },
    female: {
        subject: 'adult East Asian woman, office employee',
        cue: 'female, woman, feminine face, feminine features, long or medium female hairstyle',
        negative: 'male, man, boy, masculine jawline, beard, mustache, stubble'
    },
    other: {
        subject: 'adult East Asian person, office employee',
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
    const safeEmployeeId = toSafeText(employeeId);
    const safeNickname = toSafeText(nickname);
    const identitySource = (safeEmployeeId || safeNickname)
        ? `${safeEmployeeId}|${safeNickname}`
        : 'default';
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

    const repeatSingle = Array.from({ length: Math.max(3, strictness + 3) }, () => 'one person only, one face only, single headshot').join(', ');
    const repeatGender = Array.from({ length: Math.max(2, strictness + 2) }, () => genderGuide.cue).join(', ');

    const prompt = `High-quality cute human character avatar portrait for profile icon.
${repeatSingle}.
composition: passport-photo inspired headshot, head-and-shoulders, centered framing, front-facing, looking directly at camera.
subject: ${genderGuide.subject}.
gender lock: ${repeatGender}.
expression and tone: ${sn.detail}, ${a.trait}, ${f.expression}, ${a.vibe}.
styling: ${s.posture}, ${s.energy}, ${f.texture}, ${sn.finish}.
lighting and backdrop: ${t.lighting}, ${t.mood}, ${pl.backdrop}, ${pl.atmosphere}.
visual style: stylized 3D human character, polished game-avatar quality, soft shading, clean edges, expressive but natural face proportions.
cute style priority: adorable and friendly character design, slightly larger bright eyes, softly rounded facial contour, gentle smile, youthful and approachable look.
render quality: premium character render, smooth gradients, soft pastel color accents, glossy but natural hair detail.
render direction: clearly non-photorealistic, not a real person photo, not hyper-real skin texture.
wardrobe: simple office shirt or blouse, neutral color, minimal accessories.
strict rule: exactly one human character face, no extra people, no collage, no panel, no text, no watermark.
identity hint: ${identityHint || 'employee-default'}.`
        .replace(/\s+/g, ' ')
        .trim();

    const negativePrompt = [
        'real photo',
        'photorealistic',
        'hyperrealistic',
        'raw photo',
        'dslr',
        'film grain',
        'skin pores',
        'chibi',
        'anime style',
        'flat icon',
        'emoji',
        'mask',
        'animal character',
        'monster character',
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
        'multiple heads',
        'multiple people',
        'group',
        'crowd',
        'couple',
        'duplicate face',
        'two faces',
        'many faces',
        'full body',
        'upper body',
        'hands',
        'body pose',
        'side view',
        'profile view',
        'looking away',
        'tilted face',
        'open mouth',
        'teeth',
        'hat',
        'sunglasses',
        'earphones',
        'busy background',
        'landscape background',
        'city street',
        'forest',
        'beach',
        'space',
        'text',
        'logo',
        'watermark',
        'blurry',
        'low quality',
        'old age',
        'aged face',
        'wrinkles',
        'harsh shadows',
        'scary',
        'horror',
        'angry expression',
        'stern expression',
        'bad anatomy',
        'deformed face',
        genderGuide.negative
    ].filter(Boolean).join(', ');

    return {
        prompt,
        negativePrompt,
        seed: buildIdentitySeed({ employeeId, nickname }) + strictness * 173,
        guidanceScale: Math.min(13, 10.6 + strictness * 0.7)
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
            gridCount ? 0.82 : 0.76,
            gridCount ? -0.07 : -0.09
        );

        return focusedBlob || workingBlob;
    } catch (error) {
        console.warn('single portrait post-process skipped:', error);
        return imageBlob;
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * FLUX 모델용 자연어 프롬프트 빌더
 * FLUX는 키워드 나열보다 자연스러운 문장 프롬프트에 더 잘 반응함
 */
const buildFluxPrompt = (profileInput) => {
    const { personality: p, gender } = normalizeProfileInput(profileInput);
    const t = PERSONALITY_MAPPINGS.time[p.time] || PERSONALITY_MAPPINGS.time.morning;
    const f = PERSONALITY_MAPPINGS.feeling[p.feeling] || PERSONALITY_MAPPINGS.feeling.citrus;
    const pl = PERSONALITY_MAPPINGS.place[p.place] || PERSONALITY_MAPPINGS.place.city;
    const a = PERSONALITY_MAPPINGS.animal[p.animal] || PERSONALITY_MAPPINGS.animal.cat;
    const s = PERSONALITY_MAPPINGS.superpower[p.superpower] || PERSONALITY_MAPPINGS.superpower.teleport;
    const sn = PERSONALITY_MAPPINGS.snack[p.snack] || PERSONALITY_MAPPINGS.snack.coffee;

    const genderWord = gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'androgynous';
    const genderSubject = gender === 'male' ? 'man' : gender === 'female' ? 'woman' : 'person';

    return `A single professional headshot portrait of one ${genderWord} East Asian ${genderSubject}, office worker. Front-facing, looking directly at camera, centered framing. ${pl.backdrop}, ${pl.atmosphere} atmosphere. ${t.lighting}, ${t.mood}. ${sn.detail}, ${a.trait}, ${f.expression}, ${a.vibe} personality. ${s.posture}, ${s.energy}. Stylized 3D character art style, cute and friendly design, slightly larger bright eyes, softly rounded facial contour. Not photorealistic, not anime. Simple office attire. Clean single-person portrait only, no text, no watermark.`;
};

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

        const isFlux = model.toLowerCase().includes('flux');
        const prompt = isFlux ? buildFluxPrompt(profileInput) : spec.prompt;
        const parameters = isFlux
            ? {
                num_inference_steps: 4,
                width: 512,
                height: 512,
                seed: spec.seed
            }
            : {
                negative_prompt: spec.negativePrompt,
                num_inference_steps: 30,
                guidance_scale: spec.guidanceScale,
                width: 512,
                height: 512,
                seed: spec.seed
            };

        let response = await requestImageViaLocalApi(model, prompt, parameters);

        if (response.status === 404 && isDevMode()) {
            const directResponse = await requestImageViaDevDirectApi(model, prompt, parameters);
            if (directResponse) {
                response = directResponse;
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hugging Face API Error:', errorText);

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    error: '로그인 후 아이콘을 생성할 수 있습니다.',
                    status: response.status
                };
            }

            if (response.status === 503) {
                return {
                    success: false,
                    error: '모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
                    status: 503,
                    isLoading: true
                };
            }

            if (response.status === 429) {
                return {
                    success: false,
                    error: '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.',
                    status: 429
                };
            }

            if (response.status === 404 && isDevMode()) {
                return {
                    success: false,
                    error: '개발환경에서 /api 라우트를 찾지 못했습니다. vercel dev 실행 또는 로컬 Hugging Face 키 설정이 필요합니다.',
                    status: 404
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

        if (result.status && result.status >= 400 && result.status < 500 && !result.isLoading) {
            break;
        }

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
