'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Product } from '@/store/api';

type ImageProduct = Pick<Product, 'id' | 'name' | 'type' | 'imageUpdatedAt'>;
type ImageSize = 'list' | 'heading' | 'detail' | 'option' | 'selected' | 'summary';

interface ProductImageProps {
  product: ImageProduct;
  size: ImageSize;
  alt?: string;
}

export function ProductImage({ product, size, alt = '' }: ProductImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const variant = size === 'detail' ? 'image' : 'image/thumbnail';
  const imageUrl = product.imageUpdatedAt
    ? `/api/products/${product.id}/${variant}?v=${encodeURIComponent(product.imageUpdatedAt)}` : null;
  const showImage = imageUrl && failedUrl !== imageUrl;

  return <div className={`product-image product-image--${size} product-image--${product.type.toLowerCase()}`}>
    {showImage
      ? <Image
        unoptimized
        src={imageUrl}
        alt={alt}
        width={size === 'detail' ? 800 : 192}
        height={size === 'detail' ? 800 : 192}
        onError={() => setFailedUrl(imageUrl)}
      />
      : <b aria-hidden="true">{product.name.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || '?'}</b>}
  </div>;
}
