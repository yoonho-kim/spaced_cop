// Google Gemini Vision API Service
// 이미지를 분석하여 피드 글을 자동 생성합니다

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `당신은 SNS 피드 글 작성 전문가이자 문서 요약 전문가입니다.
이 이미지를 분석하여 다음 두 가지 경우 중 하나로 적절하게 반응해주세요.

[CASE 1: 문서, 회의록, 노트 필기 등 텍스트가 주된 이미지일 경우]
- 이미지 내의 텍스트를 최대한 빠짐없이 읽고, 상세하게 정리해주세요.
- 최소 10줄 이상으로 충분히 길고 구체적으로 작성해주세요.
- 형식:
  📋 회의/문서 요약

  ■ 핵심 주제
  (1-2줄로 요약)

  ■ 주요 내용
  (5-7개 불렛포인트로 구체적으로 정리. 각 항목은 1-2문장으로 상세히 설명)

  ■ 결론 및 액션 아이템
  (후속 조치나 결론이 있다면 2-3개 정리)
- 어조: 명확하고 정중하게 작성해주세요.
- 중요: 줄바꿈을 충분히 사용하여 가독성을 높여주세요.

[CASE 2: 인물, 풍경, 활동 등 일반적인 사진일 경우]
- 이미지의 분위기와 내용을 반영한 매력적인 SNS 피드 글을 작성해주세요.
- 회사 동료들과 공유하는 친근한 어조로 작성해주세요.
- 이모지를 적절히 활용해주세요 (2-4개).
- 분량: 4-6문장으로 작성하되, 문장 사이에 줄바꿈을 넣어주세요.

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
                    maxOutputTokens: 1024,
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API 요청에 실패했습니다.');
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('글 생성에 실패했습니다.');
        }

        return generatedText.trim();
    } catch (error) {
        console.error('Error generating post from image:', error);
        throw error;
    }
};
