'use client';

import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd';
import { useEffect, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';
import type { Product, ProductInput, ProductType } from '@/store/api';

const productTypeOptions: Array<{ value: ProductType; label: string }> = [
  { value: 'FRAME', label: 'Gọng kính' },
  { value: 'LENS', label: 'Tròng kính' },
  { value: 'CONTACT', label: 'Kính áp tròng' },
  { value: 'ACCESSORY', label: 'Phụ kiện' },
];
const wholeNumberParser = (value: string | undefined): number => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};
const wholeNumberRules = (label: string) => [
  { required: true, message: `Vui lòng nhập ${label.toLowerCase()}.` },
  { type: 'number' as const, min: 0, message: `${label} phải là số nguyên từ 0 trở lên.` },
];
const navigationKeys = new Set(['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
const preventNonIntegerKey = (event: KeyboardEvent<HTMLInputElement>): void => {
  const isShortcut = (event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());
  if (/^\d$/.test(event.key) || navigationKeys.has(event.key) || isShortcut) return;
  event.preventDefault();
};
const preventNonIntegerPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
  if (!/^\d+$/.test(event.clipboardData.getData('text').trim())) event.preventDefault();
};
const integerOnlyInputProps = { onKeyDown: preventNonIntegerKey, onPaste: preventNonIntegerPaste };
const selectInitialZero = (event: FocusEvent<HTMLInputElement>): void => {
  if (event.currentTarget.value === '0') event.currentTarget.select();
};

interface ProductFormProps {
  open: boolean;
  product: Product | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: ProductInput) => Promise<void>;
}

export function ProductForm({ open, product, loading, onClose, onSubmit }: ProductFormProps) {
  const [form] = Form.useForm<ProductInput>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(product ? { ...product } : { active: true, stockQty: 0, minStock: 0 });
  }, [form, open, product]);

  return <Modal
    className="product-form-modal"
    title={<div><span className="product-drawer__eyebrow">DANH MỤC SẢN PHẨM</span><strong>{product ? 'Chỉnh sửa' : 'Thêm sản phẩm mới'}</strong></div>}
    open={open}
    centered
    width={680}
    onCancel={onClose}
    footer={<Space><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={loading} onClick={() => void form.submit()}>Lưu sản phẩm</Button></Space>}
  >
    <Form<ProductInput> form={form} layout="vertical" onFinish={onSubmit} requiredMark="optional">
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Thông tin nhận diện</strong><span>Mã sản phẩm giúp tra cứu nhanh trong kho.</span></div>
        <div className="product-form-grid">
          <Form.Item name="sku" label="Mã sản phẩm" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mã sản phẩm.' }]}>
            <Input maxLength={80} placeholder="VD: GONG-001" />
          </Form.Item>
          <Form.Item name="barcode" label="Mã vạch"><Input maxLength={80} placeholder="Không bắt buộc" /></Form.Item>
        </div>
        <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên sản phẩm.' }]}>
          <Input maxLength={200} placeholder="VD: Gọng titanium dáng vuông" />
        </Form.Item>
        <div className="product-form-grid">
          <Form.Item name="type" label="Danh mục" rules={[{ required: true, message: 'Vui lòng chọn loại sản phẩm.' }]}><Select options={productTypeOptions} placeholder="Chọn danh mục" /></Form.Item>
          <Form.Item name="brand" label="Thương hiệu"><Input maxLength={120} placeholder="Không bắt buộc" /></Form.Item>
        </div>
      </section>
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Giá bán & tồn kho</strong><span>Chỉ nhập số nguyên không âm, đơn giá tính bằng Việt Nam đồng.</span></div>
        <div className="product-form-grid">
          <Form.Item name="costPrice" label="Giá vốn (đ)" rules={wholeNumberRules('giá vốn')}><InputNumber<number> min={0} precision={0} inputMode="numeric" parser={wholeNumberParser} style={{ width: '100%' }} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
          <Form.Item name="salePrice" label="Giá bán (đ)" rules={wholeNumberRules('giá bán')}><InputNumber<number> min={0} precision={0} inputMode="numeric" parser={wholeNumberParser} style={{ width: '100%' }} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
        </div>
        <div className="product-form-grid">
          {!product && <Form.Item name="stockQty" label="Tồn đầu kỳ" extra="Được ghi nhận là một phiếu nhập kho ban đầu." rules={wholeNumberRules('tồn đầu kỳ')}><InputNumber<number> min={0} precision={0} inputMode="numeric" parser={wholeNumberParser} style={{ width: '100%' }} onFocus={selectInitialZero} {...integerOnlyInputProps} /></Form.Item>}
          <Form.Item name="minStock" label="Tồn kho tối thiểu" extra="Cảnh báo khi tồn chạm mức này." rules={wholeNumberRules('tồn kho tối thiểu')}><InputNumber<number> min={0} precision={0} inputMode="numeric" parser={wholeNumberParser} style={{ width: '100%' }} onFocus={selectInitialZero} {...integerOnlyInputProps} /></Form.Item>
        </div>
      </section>
      <section className="product-form-section product-form-section--last">
        <div className="product-form-section__heading"><strong>Nhà cung cấp & trạng thái</strong><span>Thông tin này có thể cập nhật bất cứ lúc nào.</span></div>
        <Form.Item name="supplier" label="Nhà cung cấp"><Input maxLength={120} placeholder="Không bắt buộc" /></Form.Item>
        <Form.Item name="active" label="Đang kinh doanh" valuePropName="checked" className="product-active-field"><Switch checkedChildren="Có" unCheckedChildren="Không" /></Form.Item>
      </section>
    </Form>
  </Modal>;
}
