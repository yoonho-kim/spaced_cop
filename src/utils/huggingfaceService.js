/**
 * Hugging Face Inference API Service
 * Stable Diffusion XL을 사용한 프로필 아이콘 생성
 */

const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;
const MODEL_URL = '/api/huggingface';

// 성향 질문 → AI 프롬프트 매핑
const PERSONALITY_MAPPINGS = {
    // Q1: 좋아하는 시간대 → 색감
    time: {
        morning: { colors: 'warm yellow and orange tones', mood: 'bright and energetic' },
        afternoon: { colors: 'soft green and beige tones', mood: 'calm and relaxed' },
        evening: { colors: 'purple and pink gradient', mood: 'emotional and dreamy' },
        night: { colors: 'deep navy blue and black', mood: 'mysterious and quiet' }
    },
    // Q2: 느낌 → 형태/질감
    feeling: {
        citrus: { style: 'vibrant and crisp details', texture: 'fresh and zesty' },
        chocolate: { style: 'soft organic lines', texture: 'warm and smooth' },
        mint: { style: 'minimal clean aesthetic', texture: 'cool and sharp' }
    },
    // Q3: 드림 하우스 → 배경
    place: {
        city: { background: 'abstract modern city skyline', atmosphere: 'urban and sophisticated' },
        forest: { background: 'stylized nature with lush trees', atmosphere: 'peaceful and natural' },
        beach: { background: 'gentle ocean waves and sunny beach', atmosphere: 'refreshing and sunny' },
        space: { background: 'magic cosmic nebula and stars', atmosphere: 'infinite and wondrous' }
    },
    // Q4: 영혼 동물 → 인물 특징
    animal: {
        cat: { trait: 'elegant and independent look', vibe: 'graceful' },
        dog: { trait: 'friendly and active energetic look', vibe: 'cheerful' },
        owl: { trait: 'wise and mysterious calm look', vibe: 'thoughtful' },
        dolphin: { trait: 'flexible and social outgoing look', vibe: 'playful' }
    },
    // Q5: 초능력 → 시각적 효과
    superpower: {
        teleport: { effect: 'dynamic particles and motion blur', energy: 'high energy' },
        invisible: { effect: 'ethereal transparency and subtle glows', energy: 'mystical' },
        mindread: { effect: 'deep thoughtful gaze with aura', energy: 'spiritual' },
        fly: { effect: 'lightness and wind wisps', energy: 'dreamy' }
    },
    // Q6: 최고 간식 → 부가 특징
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
        genderCue: 'male, man, masculine facial features',
        negativeCue: 'female, woman, girl, feminine face, long eyelashes with heavy makeup'
    },
    female: {
        subject: 'adult female office worker',
        genderCue: 'female, woman, feminine facial features',
        negativeCue: 'male, man, boy, masculine face, beard stubble'
    },
    other: {
        subject: 'adult office worker',
        genderCue: 'androgynous adult person',
        negativeCue: ''
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

    const genderGuide = GENDER_MAPPINGS[gender] || {
        subject: 'adult office worker',
        genderCue: 'adult person',
        negativeCue: ''
    };

    const safeNickname = toSafeText(nickname);
    const safeEmployeeId = toSafeText(employeeId);
    const identityHint = [safeEmployeeId ? `employee-${safeEmployeeId}` : '', safeNickname ? `name-${safeNickname}` : '']
        .filter(Boolean)
        .join(', ');
    const repeatedGenderCue = Array.from({ length: Math.max(1, strictness + 1) }, () => genderGuide.genderCue).join(', ');
    const repeatedSingleCutCue = Array.from(
        { length: Math.max(2, strictness + 2) },
        () => 'single character, one person only, one frame, no duplicate face'
    ).join(', ');

    const prompt = `Disney-Pixar style character portrait, cinematic and emotional.
${repeatedSingleCutCue}.
head-and-shoulders close-up composition, centered, facing camera, face occupies most of frame.
subject: ${genderGuide.subject}, ${repeatedGenderCue}.
appearance: ${a.trait}, ${sn.detail}, subtle ${f.texture} impression, ${f.style}, ${sn.finish}.
mood: ${t.mood}, color tone: ${t.colors}, energy hint: ${s.energy}, minimal background tone inspired by ${pl.atmosphere} and ${pl.background}.
style: non-photorealistic, disney-inspired 3d character illustration, expressive eyes, soft cinematic shading, high quality character art.
identity hint: ${identityHint || 'employee-default'}.
strict rule: exactly one face, no second person, no duplicate face, no collage, no split layout, no comic panel grid, no character sheet.`
        .replace(/\s+/g, ' ')
        .trim();

    const negativePromptItems = [
        'painting',
        '3d render',
        'cgi',
        'photorealistic',
        'real photo',
        'id photo',
        'grid',
        'collage',
        'mosaic',
        '2x2',
        'four panel',
        '4-panel',
        'quadrants',
        'comic panels',
        'storyboard',
        'contact sheet',
        'diptych',
        'triptych',
        'tiled layout',
        'repeated portrait',
        'mirrored faces',
        'sprite sheet',
        'sticker sheet',
        'avatar sheet',
        'icon set',
        'multiple heads',
        'many faces',
        'split screen',
        'multiple images',
        'several people',
        'group',
        'crowd',
        'couple',
        'family',
        'friends',
        'two faces',
        'duplicate face',
        'extra face',
        'character sheet',
        'watermark',
        'signature',
        'text',
        'logo',
        'mascot logo',
        'chibi',
        'flat icon sheet',
        'deformed face',
        'bad anatomy',
        'blurry',
        'low quality',
        'out of frame',
        'cropped head'
    ];

    if (genderGuide.negativeCue) {
        negativePromptItems.push(genderGuide.negativeCue);
    }

    return {
        prompt,
        negativePrompt: negativePromptItems.join(', '),
        seed: buildIdentitySeed({ employeeId, nickname }) + strictness * 101,
        guidanceScale: Math.min(12, 10 + strictness * 0.6)
    };
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
        const spec = buildGenerationSpec(profileInput, strictness);

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: spec.prompt,
                parameters: {
                    negative_prompt: spec.negativePrompt,
                    num_inference_steps: 50,
                    guidance_scale: spec.guidanceScale,
                    num_images: 1,
                    width: 512,
                    height: 512,
                    seed: spec.seed
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hugging Face API Error:', errorText);

            // 모델 로딩 중인 경우
            if (response.status === 503) {
                return {
                    success: false,
                    error: '모델을 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
                    isLoading: true
                };
            }

            return {
                success: false,
                error: `아이콘 생성 실패: ${response.status}`
            };
        }

        // 응답은 이미지 blob
        const imageBlob = await response.blob();
        const processedBlob = await enforceSingleCharacterPortrait(imageBlob);

        // Blob을 Base64로 변환
        const base64 = await blobToBase64(processedBlob);

        return {
            success: true,
            imageData: base64,
            prompt: spec.prompt
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
 * Blob을 Base64 문자열로 변환
 */
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
    const candidates = [3, 2, 4];

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

const cropCenterCell = async (image, gridCount) => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const cropWidth = Math.round(sourceWidth / gridCount);
    const cropHeight = Math.round(sourceHeight / gridCount);
    const sourceX = Math.round(sourceWidth / 2 - cropWidth / 2);
    const sourceY = Math.round(sourceHeight / 2 - cropHeight / 2);

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

const cropCenterFocus = async (image, ratio = 0.42, yBias = -0.05) => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const safeRatio = Math.max(0.3, Math.min(1, ratio));
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

const enforceSingleCharacterPortrait = async (imageBlob) => {
    try {
        const originalImage = await loadImageFromBlob(imageBlob);
        let workingImage = originalImage;
        let workingBlob = imageBlob;
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

        if (gridCount) {
            const croppedByGrid = await cropCenterCell(originalImage, gridCount);
            if (croppedByGrid) {
                workingBlob = croppedByGrid;
                workingImage = await loadImageFromBlob(croppedByGrid);
            }
        }

        // 분할 감지 여부와 무관하게 중앙 인물 한 컷으로 강제 포커스 크롭
        const focused = await cropCenterFocus(
            workingImage,
            gridCount ? 0.9 : 0.42,
            gridCount ? -0.03 : -0.05
        );
        return focused || workingBlob;
    } catch (error) {
        console.warn('single portrait post-process skipped:', error);
        return imageBlob;
    }
};

/**
 * 재시도 로직이 포함된 아이콘 생성
 * 모델 로딩 시간을 고려하여 최대 3회 재시도
 */
export const generateProfileIconWithRetry = async (profileInput, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await generateProfileIcon(profileInput, { strictness: attempt - 1 });

        if (result.success) {
            return result;
        }

        if (result.isLoading && attempt < maxRetries) {
            // 모델 로딩 중이면 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
            continue;
        }

        return result;
    }

    return {
        success: false,
        error: '아이콘 생성에 실패했습니다. 나중에 다시 시도해주세요.'
    };
};

export default {
    generateProfileIcon,
    generateProfileIconWithRetry,
    generatePrompt
};
