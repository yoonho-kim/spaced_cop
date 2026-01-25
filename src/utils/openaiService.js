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
                                text: `당신은 SNS 피드 글 작성 전문가입니다. 이 이미지를 보고 한국어로 자연스럽고 매력적인 SNS 피드 글을 작성해주세요.

작성 가이드라인:
- 이미지의 분위기와 내용을 잘 반영해주세요
- 자연스럽고 친근한 어조로 작성해주세요
- 이모지를 적절히 활용해주세요 (2-4개 정도)
- 글의 길이는 2-4문장 정도로 작성해주세요
- 해시태그는 포함하지 마세요
- 회사 동료들과 공유하는 글이라고 가정해주세요

이미지를 분석하고 SNS 피드 글만 작성해주세요. 다른 설명 없이 글 내용만 응답해주세요.`
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
                    maxOutputTokens: 300,
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
