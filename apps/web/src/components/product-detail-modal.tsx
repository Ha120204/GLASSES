'use client';

import { EditOutlined } from '@ant-design/icons';
import { Button, Modal, Space } from 'antd';
import type { ReactNode } from 'react';
import type { Product, ProductType } from '@/store/api';

const typeLabels: Record<ProductType, string> = {
  FRAME: 'Gọng kính',
  LENS: 'Tròng kính',
  CONTACT: 'Kính áp tròng',
  ACCESSORY: 'Phụ kiện',
};
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
}

interface DetailItemProps {
  label: string;
  children: ReactNode;
  full?: boolean;
}

function DetailItem({ label, children, full = false }: DetailItemProps) {
  return <div className={`product-detail-modal__item${full ? ' product-detail-modal__item--full' : ''}`}>
    <span>{label}</span>
    <strong>{children}</strong>
  </div>;
}

export function ProductDetailModal({ product, open, onClose, onEdit }: ProductDetailModalProps) {
  return <Modal
    className="product-detail-modal"
    open={open}
    onCancel={onClose}
    width={640}
    title={product ? <div className="product-detail-modal__heading">
      <span className={`product-identity__initial product-identity__initial--${product.type.toLowerCase()}`}>{product.name.slice(0, 1).toUpperCase()}</span>
      <div>
        <span>CHI TIẾT SẢN PHẨM</span>
        <strong>{product.name}</strong>
        <em>SKU · {product.sku}</em>
      </div>
    </div> : 'Chi tiết sản phẩm'}
    footer={product ? <Space size={8}>
      <Button onClick={onClose}>Đóng</Button>
      <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(product)}>Chỉnh sửa</Button>
    </Space> : null}
  >
    {product && <>
      <div className="product-detail-modal__meta">
        <span className={`product-type product-type--${product.type.toLowerCase()}`}>{typeLabels[product.type]}</span>
        <span className={`product-status ${product.active ? 'product-status--active' : ''}`}><i />{product.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span>
      </div>
      <section className="product-detail-modal__prices" aria-label="Thông tin giá">
        <div><span>Giá bán</span><strong>{formatMoney(product.salePrice)}</strong></div>
        <div><span>Giá vốn</span><strong>{formatMoney(product.costPrice)}</strong></div>
      </section>
      <section className="product-detail-modal__section">
        <div className="product-detail-modal__section-heading">
          <strong>Thông tin sản phẩm</strong>
          <span>Thông tin nhận diện và nguồn hàng</span>
        </div>
        <div className="product-detail-modal__grid">
          <DetailItem label="Mã sản phẩm">{product.sku}</DetailItem>
          <DetailItem label="Mã vạch">{product.barcode || 'Chưa cập nhật'}</DetailItem>
          <DetailItem label="Danh mục">{typeLabels[product.type]}</DetailItem>
          <DetailItem label="Thương hiệu">{product.brand || 'Chưa cập nhật'}</DetailItem>
          <DetailItem label="Nhà cung cấp" full>{product.supplier || 'Chưa cập nhật'}</DetailItem>
        </div>
      </section>
    </>}
  </Modal>;
}
