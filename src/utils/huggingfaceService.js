/**
 * Hugging Face Inference API Service
 * Stable Diffusion XL을 사용한 프로필 아이콘 생성
 */

const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;
const MODEL_URL = '/api/huggingface/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0';

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
        citrus: { shape: 'sharp angular geometric shapes', texture: 'bright and crisp' },
        chocolate: { shape: 'soft rounded organic shapes', texture: 'smooth and warm' },
        mint: { shape: 'clean straight lines', texture: 'minimal and cool' }
    },
    // Q3: 드림 하우스 → 배경
    place: {
        city: { background: 'abstract city skyline silhouettes', elements: 'modern buildings' },
        forest: { background: 'stylized trees and leaves', elements: 'nature and greenery' },
        beach: { background: 'gentle waves and sand patterns', elements: 'ocean and sun' },
        space: { background: 'stars and cosmic nebula', elements: 'planets and galaxies' }
    }
};

/**
 * 성향 데이터를 기반으로 AI 프롬프트 생성
 */
export const generatePrompt = (personality) => {
    const timeData = PERSONALITY_MAPPINGS.time[personality.time] || PERSONALITY_MAPPINGS.time.morning;
    const feelingData = PERSONALITY_MAPPINGS.feeling[personality.feeling] || PERSONALITY_MAPPINGS.feeling.citrus;
    const placeData = PERSONALITY_MAPPINGS.place[personality.place] || PERSONALITY_MAPPINGS.place.city;

    // 인물(Human) 중심의 3D 캐릭터 스타일 프롬프트
    const prompt = `Cute 3d character avatar, stylized person portrait, pixar style, disney style, ${timeData.colors}, ${timeData.mood} atmosphere, ${feelingData.shape} design elements, ${feelingData.texture} texture, ${placeData.background} background, soft studio lighting, octane render, high quality, detailed, 8k, 1:1 aspect ratio, looking at camera`;

    return prompt;
};

/**
 * 프로필 아이콘 생성
 * @param {Object} personality - 성향 데이터 { time, feeling, place }
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
                    negative_prompt: 'ugly, blurry, low quality, text, watermark, signature, deformed, bad anatomy, disfigured, logo, icon, flat',
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
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
