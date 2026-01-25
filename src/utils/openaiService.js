// Google Gemini Vision API Service
// 이미지를 분석하여 피드 글을 자동 생성합니다

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * 파일을 Base64 문자열로 변환
 */
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // data:image/jpeg;base64,/9j/4AAQ... 형태에서 base64 부분만 추출
            const base64 = reader.result.split(',')[1];
            resolve(base64);
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
        const base64Image = await fileToBase64(imageFile);
        const mimeType = imageFile.type || 'image/jpeg';

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
                                    data: base64Image
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
