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

/**
 * 성향 데이터를 기반으로 AI 프롬프트 생성
 * 항상 사람 캐릭터가 나오도록 강화된 프롬프트
 * 유저의 요구사항: "무조건 한 명"의 사람만 나오도록 함
 */
export const generatePrompt = (personality) => {
    const p = personality;
    const t = PERSONALITY_MAPPINGS.time[p.time] || PERSONALITY_MAPPINGS.time.morning;
    const f = PERSONALITY_MAPPINGS.feeling[p.feeling] || PERSONALITY_MAPPINGS.feeling.citrus;
    const pl = PERSONALITY_MAPPINGS.place[p.place] || PERSONALITY_MAPPINGS.place.city;
    const a = PERSONALITY_MAPPINGS.animal[p.animal] || PERSONALITY_MAPPINGS.animal.cat;
    const s = PERSONALITY_MAPPINGS.superpower[p.superpower] || PERSONALITY_MAPPINGS.superpower.teleport;
    const sn = PERSONALITY_MAPPINGS.snack[p.snack] || PERSONALITY_MAPPINGS.snack.coffee;

    // "SINGLE CHARACTER"와 "SOLO"를 매우 강력하게 강조. 그리드 방지 문구 포함.
    const prompt = `One single 3d cartoon character, only one person visible. 
    A solo portrait of a young adult, centered, directly facing camera. 
    human face, expressive eyes, ${a.trait}, ${sn.detail}.
    style: pixar disney animation style, ${f.style}, ${s.effect}, ${sn.finish}.
    colors: ${t.colors} palette, ${t.mood} atmosphere.
    background: single ${pl.background} background.
    no grid, no collage, no split screen, no multiple views, no frames, no boarders, only one person.`;

    return prompt.replace(/\s+/g, ' ').trim();
};

/**
 * 프로필 아이콘 생성
 * @param {Object} personality - 성향 데이터 { time, feeling, place, animal, superpower, snack }
 * @returns {Promise<{ success: boolean, imageData?: string, prompt?: string, error?: string }>}
 */
export const generateProfileIcon = async (personality) => {
    try {
        const prompt = generatePrompt(personality);

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    // 그리드, 콜라주, 여러 인물을 방지하는 문구들을 대폭 강화
                    negative_prompt: 'grid, collage, mosaic, split screen, multiple images, four panels, two panels, 2x2, duplicate, several people, group of people, more than one person, crowd, couple, family, friends, animals, objects only, low quality, blurry, text, logo, bad anatomy, deformed face, two faces, multiple views, character sheet, watermark, signature',
                    num_inference_steps: 40, // 퀄리티를 위해 스텝 수 약간 증가
                    guidance_scale: 8.0,
                    width: 512,
                    height: 512
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

        // Blob을 Base64로 변환
        const base64 = await blobToBase64(imageBlob);

        return {
            success: true,
            imageData: base64,
            prompt: prompt
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

/**
 * 재시도 로직이 포함된 아이콘 생성
 * 모델 로딩 시간을 고려하여 최대 3회 재시도
 */
export const generateProfileIconWithRetry = async (personality, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await generateProfileIcon(personality);

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
