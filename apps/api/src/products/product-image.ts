import { BadRequestException } from '@nestjs/common';
import * as sharpModule from 'sharp';

const sharp = sharpModule as unknown as typeof sharpModule.default;

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const mimeByFormat = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export async function prepareProductImage(file?: Express.Multer.File): Promise<{
  content: Uint8Array<ArrayBuffer>;
  thumbnail: Uint8Array<ArrayBuffer>;
  mimeType: 'image/webp';
}> {
  if (!file?.buffer?.length || file.size > MAX_PRODUCT_IMAGE_BYTES || file.buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new BadRequestException('Ảnh sản phẩm không hợp lệ hoặc vượt quá 5 MB.');
  }

  try {
    const metadata = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).metadata();
    const mimeType = mimeByFormat[metadata.format as keyof typeof mimeByFormat];
    if (!mimeType || file.mimetype !== mimeType || !metadata.width || !metadata.height
      || metadata.width * metadata.height > MAX_INPUT_PIXELS || (metadata.pages ?? 1) > 1) {
      throw new Error('Unsupported product image');
    }

    const [content, thumbnail] = await Promise.all([
      sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer(),
      sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
        .rotate().resize(192, 192, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 }).toBuffer(),
    ]);
    return { content: Uint8Array.from(content), thumbnail: Uint8Array.from(thumbnail), mimeType: 'image/webp' };
  } catch {
    throw new BadRequestException('Ảnh bị hỏng hoặc không đúng định dạng JPEG, PNG, WebP.');
  }
}
