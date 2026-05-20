export type ResizeToWebPResult = {
  file: File;
  width: number;
  height: number;
};

type ResizeToWebPOptions = {
  maxWidth?: number;
  quality?: number;
  fileName?: string;
};

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_QUALITY = 0.8;

const loadImage = (file: File): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };
    image.src = objectUrl;
  })
);

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> => (
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('이미지를 WebP로 변환하지 못했습니다.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  })
);

export const resizeToWebP = async (
  file: File,
  {
    maxWidth = DEFAULT_MAX_WIDTH,
    quality = DEFAULT_QUALITY,
    fileName,
  }: ResizeToWebPOptions = {},
): Promise<ResizeToWebPResult> => {
  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('이미지 크기를 확인할 수 없습니다.');
  }

  const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('브라우저에서 이미지 변환을 처리할 수 없습니다.');
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/webp', quality);
  const outputName = fileName || `${file.name.replace(/\.[^.]+$/, '') || 'feed-image'}.webp`;

  return {
    file: new File([blob], outputName, {
      type: 'image/webp',
      lastModified: Date.now(),
    }),
    width,
    height,
  };
};
