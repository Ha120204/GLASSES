'use client';

import { Button, Descriptions, Empty, Modal, Space, Spin, Tag } from 'antd';
import { useState } from 'react';
import { StockMovementForm } from './stock-movement-form';
import { type Product, type ProductType, type StockMovement, useProductStockMovementsQuery } from '@/store/api';

const productTypeLabels: Record<ProductType, string> = {
  FRAME: 'Gọng kính',
  LENS: 'Tròng kính',
  CONTACT: 'Kính áp tròng',
  ACCESSORY: 'Phụ kiện',
};
const movementLabels: Record<StockMovement['type'], string> = { IN: 'Nhập kho', OUT: 'Xuất kho', ADJUST: 'Điều chỉnh' };
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
}

export function ProductDetailModal({ product, open, onClose, onEdit, onProductUpdated }: ProductDetailModalProps) {
  const [movementOpen, setMovementOpen] = useState(false);
  const { data: history, isFetching } = useProductStockMovementsQuery(
    { id: product?.id ?? '', page: 1, pageSize: 10 },
    { skip: !product || !open },
  );

  if (!product) return null;
  const isLowStock = product.stockQty <= product.minStock;
  const updateProduct = (updatedProduct: Product): void => {
    onProductUpdated(updatedProduct);
  };
  return <>
    <Modal
      className="product-detail-modal"
      open={open}
      centered
      onCancel={onClose}
      title={<div><span className="product-drawer__eyebrow">CHI TIẾT SẢN PHẨM</span><strong>{product.name}</strong><span className="product-detail-modal__sku">{product.sku}</span></div>}
      footer={<Space><Button onClick={() => onEdit(product)}>Chỉnh sửa</Button><Button type="primary" onClick={() => setMovementOpen(true)}>Nhập / Xuất kho</Button></Space>}
    >
      <div className="product-detail-modal__badges">
        <span className={`product-type product-type--${product.type.toLowerCase()}`}>{productTypeLabels[product.type]}</span>
        <span className={`product-status ${product.active ? 'product-status--active' : ''}`}><i />{product.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span>
        {isLowStock && <Tag color="volcano">Tồn kho cần chú ý</Tag>}
      </div>
      <Descriptions column={1} bordered size="small" items={[
        { key: 'barcode', label: 'Mã vạch', children: product.barcode || '—' },
        { key: 'brand', label: 'Thương hiệu', children: product.brand || '—' },
        { key: 'costPrice', label: 'Giá vốn', children: formatMoney(product.costPrice) },
        { key: 'salePrice', label: 'Giá bán', children: formatMoney(product.salePrice) },
        { key: 'stockQty', label: 'Tồn kho hiện tại', children: <b className={isLowStock ? 'product-detail-modal__low-stock' : ''}>{product.stockQty}</b> },
        { key: 'minStock', label: 'Tồn kho tối thiểu', children: product.minStock },
        { key: 'supplier', label: 'Nhà cung cấp', children: product.supplier || '—' },
      ]} />
      <section className="stock-history">
        <div className="stock-history__heading"><div><strong>Lịch sử biến động</strong><span>10 thao tác gần nhất</span></div><b>{history?.total ?? 0}</b></div>
        {isFetching ? <div className="stock-history__loading"><Spin size="small" /></div> : history?.items.length ? <div className="stock-history__list">
          {history.items.map((movement) => <div className="stock-history__item" key={movement.id}>
            <span className={`stock-history__kind stock-history__kind--${movement.qty >= 0 ? 'in' : 'out'}`}>{movementLabels[movement.type]}</span>
            <div className="stock-history__content"><strong>{movement.note || 'Không có ghi chú'}</strong><span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.createdAt))}</span></div>
            <b className={movement.qty >= 0 ? 'stock-history__qty--in' : 'stock-history__qty--out'}>{movement.qty >= 0 ? '+' : ''}{movement.qty}</b>
          </div>)}
        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có biến động kho" />}
      </section>
    </Modal>
    <StockMovementForm product={product} open={movementOpen} onClose={() => setMovementOpen(false)} onSuccess={updateProduct} />
  </>;
}
