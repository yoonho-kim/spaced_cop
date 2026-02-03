// Google Gemini Vision API Service
// 이미지를 분석하여 피드 글을 자동 생성합니다

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Gemini 모델 후보 (접근 권한/지원 여부에 따라 fallback)
const MODEL_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-lite',
];

const isRetryableModelError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const status = error?.status;
    return (
        status === 404 ||
        (status === 403 && (
            message.includes('not found') ||
            message.includes('not supported') ||
            message.includes('does not exist') ||
            message.includes('not enabled') ||
            message.includes('permission')
        )) ||
        (status === 400 && message.includes('model'))
    );
};

const extractJson = (text) => {
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
};

const callGemini = async (modelName, body) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const error = new Error(data?.error?.message || 'API 요청에 실패했습니다.');
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
};

// 이미지 압축 설정
const MAX_IMAGE_SIZE = 1024; // 최대 너비/높이 (px)
const IMAGE_QUALITY = 0.7;   // JPEG 품질 (0.0 - 1.0)

/**
 * 이미지를 리사이즈하고 압축
 * @param {File} file - 원본 이미지 파일
 * @returns {Promise<{base64: string, mimeType: string}>} - 압축된 Base64 이미지
 */
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                // 캔버스 생성
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 비율 유지하면서 리사이즈
                let { width, height } = img;

                if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
                    if (width > height) {
                        height = Math.round((height * MAX_IMAGE_SIZE) / width);
                        width = MAX_IMAGE_SIZE;
                    } else {
                        width = Math.round((width * MAX_IMAGE_SIZE) / height);
                        height = MAX_IMAGE_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // 이미지 그리기
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG로 압축하여 Base64 추출
                const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
                const base64 = dataUrl.split(',')[1];

                console.log(`이미지 압축 완료: ${img.width}x${img.height} → ${width}x${height}`);

                resolve({
                    base64,
                    mimeType: 'image/jpeg'
                });
            };

            img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));
        };

        reader.onerror = (error) => reject(error);
    });
};

/**
 * 이미지 파일을 분석하여 피드 글을 생성
 * @param {File} imageFile - 업로드된 이미지 파일
 * @returns {Promise<string>} - 생성된 피드 글
 */
export const generatePostFromImage = async (imageFile) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 VITE_GEMINI_API_KEY를 추가해주세요.');
    }

    try {
        // 이미지 압축 (모바일 대용량 사진 대응)
        console.log(`원본 파일 크기: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB`);
        const { base64, mimeType } = await compressImage(imageFile);
        console.log(`압축 후 Base64 크기: ${(base64.length / 1024).toFixed(2)}KB`);

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `당신은 SNS 피드 글 작성 전문가이자 문서 요약 전문가입니다.
이 이미지를 분석하여 다음 두 가지 경우 중 하나로 적절하게 반응해주세요.

[CASE 1: 문서, 회의록, 노트 필기 등 텍스트가 주된 이미지일 경우]
- 이미지 내의 텍스트를 읽고 핵심 내용을 요약해주세요.
- 출력은 10줄 이내로 작성해주세요. 줄바꿈을 포함해 10줄을 넘기지 마세요.
- 형식:
  "[회의/문서 요약]"
  - 핵심 주제: (한 줄 요약)
  - 주요 내용: (3~6개 불렛포인트로 요약)
- 어조: 명확하고 정중하게 작성해주세요.

[CASE 2: 인물, 풍경, 활동 등 일반적인 사진일 경우]
- 이미지의 분위기와 내용을 반영한 매력적인 SNS 피드 글을 작성해주세요.
- 회사 동료들과 공유하는 친근한 어조로 작성해주세요.
- 이모지를 적절히 활용해주세요 (2~4개).
- 분량: 2~4문장.

이미지를 보고 위 두 가지 케이스 중 더 적합한 쪽을 판단하여 작성해주세요. 판단에 대한 설명은 생략하고 결과물만 출력해주세요.`
                        },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 280,
            }
        };

        let lastError;
        for (const modelName of MODEL_CANDIDATES) {
            try {
                const data = await callGemini(modelName, requestBody);
                const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!generatedText) {
                    throw new Error('글 생성에 실패했습니다.');
                }

                const trimmed = generatedText.trim();
                const lines = trimmed.split('\n').filter(line => line.trim().length > 0);
                if (lines.length > 10) {
                    return lines.slice(0, 10).join('\n');
                }
                return trimmed;
            } catch (error) {
                lastError = error;
                if (!isRetryableModelError(error)) {
                    throw error;
                }
            }
        }

        throw lastError || new Error('글 생성에 실패했습니다.');
    } catch (error) {
        console.error('Error generating post from image:', error);
        throw error;
    }
};

/**
 * 이벤트 팜플렛 문구 생성 (텍스트 기반)
 * @param {string} description - 이벤트 설명
 * @returns {Promise<{ title: string, subtitle: string, bullets: string[], cta: string }>}
 */
export const generateEventPamphlet = async (description) => {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 VITE_GEMINI_API_KEY를 추가해주세요.');
    }

    if (!description || !description.trim()) {
        throw new Error('이벤트 설명이 필요합니다.');
    }

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: `당신은 회사 내부 이벤트 팜플렛 카피라이터입니다.
아래 이벤트 설명을 바탕으로 간결하고 모던한 팜플렛 문구를 만들어주세요.
출력은 반드시 JSON 형식으로만 작성해주세요.

요구사항:
- title: 1줄 (짧고 임팩트 있게)
- subtitle: 1줄 (부연 설명)
- bullets: 3~5개 (핵심 포인트)
- cta: 1줄 (참여 유도 문구)

JSON 예시:
{"title":"...","subtitle":"...","bullets":["...","..."],"cta":"..."}

이벤트 설명: ${description}`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 260,
        }
    };

    let lastError;
    for (const modelName of MODEL_CANDIDATES) {
        try {
            const data = await callGemini(modelName, requestBody);
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!rawText) {
                throw new Error('팜플렛 생성에 실패했습니다.');
            }

            const jsonText = extractJson(rawText) || rawText;
            const parsed = JSON.parse(jsonText);

            return {
                title: parsed.title || '',
                subtitle: parsed.subtitle || '',
                bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
                cta: parsed.cta || ''
            };
        } catch (error) {
            lastError = error;
            if (error instanceof SyntaxError) {
                // JSON 파싱 실패는 다른 모델 재시도
                continue;
            }
            if (!isRetryableModelError(error)) {
                throw error;
            }
        }
    }

    if (lastError instanceof SyntaxError) {
        throw new Error('팜플렛 생성에 실패했습니다. 다시 시도해주세요.');
    }

    throw lastError || new Error('팜플렛 생성에 실패했습니다.');
};
