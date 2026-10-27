'use client';

import { Button, Collapse, Form, Input, InputNumber, Modal, Select, Space, Switch, type InputNumberProps } from 'antd';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useLazyNextProductSkuQuery, type Product, type ProductInput, type ProductType } from '@/store/api';
import { formatVndInput } from '@/lib/money-input';

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
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

function MoneyInput({ style, ...props }: InputNumberProps<number>) {
  return <Space.Compact block className="product-form-money-input">
    <InputNumber<number> {...props} style={{ width: '100%', ...style }} />
    <span aria-hidden="true">đ</span>
  </Space.Compact>;
}

interface ProductFormProps {
  open: boolean;
  product: Product | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: ProductInput) => Promise<void>;
}

export function ProductForm({ open, product, loading, onClose, onSubmit }: ProductFormProps) {
  const [form] = Form.useForm<ProductInput>();
  const [skuMode, setSkuMode] = useState<'auto' | 'manual'>('auto');
  const skuModeRef = useRef<'auto' | 'manual'>('auto');
  const selectedTypeRef = useRef<ProductType | null>(null);
  const [requestNextSku] = useLazyNextProductSkuQuery();
  const costPrice = Form.useWatch('costPrice', form) ?? 0;
  const salePrice = Form.useWatch('salePrice', form) ?? 0;
  const profit = salePrice - costPrice;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(product ? { ...product } : { active: true });
    const nextSkuMode = product ? 'manual' : 'auto';
    skuModeRef.current = nextSkuMode;
    selectedTypeRef.current = product?.type ?? null;
    setSkuMode(nextSkuMode);
  }, [form, open, product]);

  const suggestSku = (requestedType: ProductType): void => {
    selectedTypeRef.current = requestedType;
    if (product || skuModeRef.current !== 'auto') return;
    void requestNextSku(requestedType).unwrap().then(({ sku }) => {
      if (selectedTypeRef.current === requestedType && skuModeRef.current === 'auto') {
        form.setFields([{ name: 'sku', value: sku, touched: false }]);
      }
    }).catch(() => undefined);
  };

  const submit = (values: ProductInput): Promise<void> => onSubmit({
    ...values,
    autoSku: !product && skuMode === 'auto',
  });

  return <Modal
    className="product-form-modal"
    title={<div className="product-form-modal__title"><span>DANH MỤC SẢN PHẨM</span><strong>{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</strong><p>{product ? 'Cập nhật thông tin và giá bán của sản phẩm.' : 'Hoàn tất thông tin cơ bản để đưa sản phẩm vào danh mục.'}</p></div>}
    open={open}
    centered
    width={680}
    onCancel={onClose}
    footer={<div className="product-form-modal__footer"><span>Các trường có <b>*</b> là bắt buộc</span><Space><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={loading} onClick={() => void form.submit()}>Lưu sản phẩm</Button></Space></div>}
  >
    <Form<ProductInput>
      className="product-form-modal__form"
      form={form}
      layout="vertical"
      onFinish={submit}
      onFinishFailed={({ errorFields }) => { if (errorFields[0]) form.scrollToField(errorFields[0].name, { block: 'center' }); }}
      requiredMark={false}
    >
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Thông tin cơ bản</strong><span>Đặt tên rõ ràng để dễ tìm và bán hàng.</span></div>
        <Form.Item name="name" label={<>Tên sản phẩm <b className="product-form-required">*</b></>} rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên sản phẩm.' }]}>
          <Input maxLength={200} placeholder="VD: Gọng titanium dáng vuông" autoFocus />
        </Form.Item>
        <div className="product-form-grid">
          <Form.Item name="type" label={<>Danh mục <b className="product-form-required">*</b></>} rules={[{ required: true, message: 'Vui lòng chọn loại sản phẩm.' }]}><Select options={productTypeOptions} placeholder="Chọn danh mục" onChange={suggestSku} /></Form.Item>
          <Form.Item name="brand" label="Thương hiệu"><Input maxLength={120} placeholder="VD: Ray-Ban" /></Form.Item>
        </div>
        <div className="product-form-grid">
          <Form.Item name="sku" label={<>Mã sản phẩm <b className="product-form-required">*</b></>} extra={skuMode === 'auto' ? 'Tự tạo theo danh mục; bạn vẫn có thể sửa.' : 'Mã đã được chỉnh thủ công.'} rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mã sản phẩm.' }]}>
            <Input maxLength={80} placeholder="VD: GONG-001" onChange={() => { skuModeRef.current = 'manual'; setSkuMode('manual'); }} />
          </Form.Item>
          <Form.Item name="barcode" label="Mã vạch"><Input maxLength={80} placeholder="Nhập nếu sản phẩm có mã vạch" /></Form.Item>
        </div>
      </section>
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Giá sản phẩm</strong><span>Đơn giá tính bằng Việt Nam đồng.</span></div>
        <div className="product-form-grid">
          <Form.Item name="costPrice" label={<>Giá vốn <b className="product-form-required">*</b></>} rules={wholeNumberRules('giá vốn')}><MoneyInput min={0} precision={0} inputMode="numeric" formatter={formatVndInput} parser={wholeNumberParser} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
          <Form.Item name="salePrice" label={<>Giá bán <b className="product-form-required">*</b></>} rules={wholeNumberRules('giá bán')}><MoneyInput min={0} precision={0} inputMode="numeric" formatter={formatVndInput} parser={wholeNumberParser} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
        </div>
        <div className={`product-form-profit${profit < 0 ? ' product-form-profit--negative' : ''}`} aria-live="polite">
          <span>Lợi nhuận ước tính</span><strong>{formatMoney(profit)}</strong><em>{margin.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% giá bán</em>
        </div>
      </section>
      <Collapse
        className="product-form-advanced"
        ghost
        items={[{ key: 'advanced', label: <div><strong>Thông tin nâng cao</strong><span>Nhà cung cấp và trạng thái kinh doanh</span></div>, children: <div className="product-form-advanced__content">
          <Form.Item name="supplier" label="Nhà cung cấp"><Input maxLength={120} placeholder="VD: Công ty ABC" /></Form.Item>
          <Form.Item name="active" label="Trạng thái kinh doanh" valuePropName="checked" className="product-active-field"><Switch checkedChildren="Đang bán" unCheckedChildren="Tạm ngừng" /></Form.Item>
        </div> }]}
      />
    </Form>
  </Modal>;
}
