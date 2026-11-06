'use client';

import { DeleteOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Collapse, Form, Input, InputNumber, Modal, Select, Space, Switch, message, type InputNumberProps } from 'antd';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { getErrorMessage, useLazyNextProductSkuQuery, useRemoveProductImageMutation, useUploadProductImageMutation, type Product, type ProductInput, type ProductType } from '@/store/api';
import { formatVndInput } from '@/lib/money-input';

const productTypeOptions: Array<{ value: ProductType; label: string }> = [
  { value: 'FRAME', label: 'Gọng kính' },
  { value: 'LENS', label: 'Tròng kính' },
  { value: 'CONTACT', label: 'Kính áp tròng' },
  { value: 'ACCESSORY', label: 'Phụ kiện' },
];
const MAX_PRICE = 2147483647;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const wholeNumberParser = (value: string | undefined): number => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};
const wholeNumberRules = (label: string) => [
  { required: true, message: `Vui lòng nhập ${label.toLowerCase()}.` },
  { type: 'number' as const, min: 0, message: `${label} phải là số nguyên từ 0 trở lên.` },
  { type: 'number' as const, max: MAX_PRICE, message: `${label} vượt quá giới hạn cho phép.` },
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
  onSubmit: (values: ProductInput, savedProductId: string | null) => Promise<Product>;
  onSaved: (product: Product) => void;
  initialType?: ProductType;
  zIndex?: number;
}

export function ProductForm({ open, product, loading, onClose, onSubmit, onSaved, initialType, zIndex }: ProductFormProps) {
  const [form] = Form.useForm<ProductInput>();
  const [skuMode, setSkuMode] = useState<'auto' | 'manual'>('auto');
  const [skuSuggestionStatus, setSkuSuggestionStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const skuModeRef = useRef<'auto' | 'manual'>('auto');
  const selectedTypeRef = useRef<ProductType | null>(null);
  const skuRequestRef = useRef(0);
  const createRequestKey = useRef('');
  const submittingRef = useRef(false);
  const hasUserChangesRef = useRef(false);
  const closeConfirmOpenRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedProductIdRef = useRef<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [requestNextSku] = useLazyNextProductSkuQuery();
  const [uploadProductImage, uploadImageState] = useUploadProductImageMutation();
  const [removeProductImage, removeImageState] = useRemoveProductImageMutation();
  const isSaving = loading || uploadImageState.isLoading || removeImageState.isLoading;
  const costPrice = Form.useWatch('costPrice', form) ?? 0;
  const salePrice = Form.useWatch('salePrice', form) ?? 0;
  const profit = salePrice - costPrice;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  const savedImageUrl = product?.imageUpdatedAt && !removeImage
    ? `/api/products/${product.id}/image?v=${encodeURIComponent(product.imageUpdatedAt)}` : null;
  const previewSrc = imagePreviewUrl ?? savedImageUrl;

  const setSuggestedSku = useCallback((value?: string): void => {
    // rc-field-form shares empty errors and warnings; replace errors only when needed.
    form.setFields([{
      name: 'sku',
      value,
      touched: false,
      ...(form.getFieldError('sku').length ? { errors: [] } : {}),
    }]);
  }, [form]);

  const requestSkuSuggestion = useCallback((requestedType: ProductType): void => {
    const requestId = ++skuRequestRef.current;
    selectedTypeRef.current = requestedType;
    setSkuSuggestionStatus('loading');
    setSuggestedSku(undefined);
    void requestNextSku(requestedType).unwrap().then(({ sku }) => {
      if (skuRequestRef.current !== requestId || selectedTypeRef.current !== requestedType || skuModeRef.current !== 'auto') return;
      setSuggestedSku(sku);
      setSkuSuggestionStatus('idle');
    }).catch(() => {
      if (skuRequestRef.current === requestId && selectedTypeRef.current === requestedType && skuModeRef.current === 'auto') {
        setSkuSuggestionStatus('error');
      }
    });
  }, [requestNextSku, setSuggestedSku]);

  useEffect(() => {
    if (!open) return;
    createRequestKey.current = product ? '' : crypto.randomUUID();
    submittingRef.current = false;
    hasUserChangesRef.current = false;
    savedProductIdRef.current = null;
    setImageFile(null);
    setRemoveImage(false);
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    skuRequestRef.current += 1;
    form.resetFields();
    form.setFieldsValue(product ? { ...product } : { active: true, type: initialType });
    const nextSkuMode = product ? 'manual' : 'auto';
    skuModeRef.current = nextSkuMode;
    selectedTypeRef.current = product?.type ?? initialType ?? null;
    setSkuMode(nextSkuMode);
    setSkuSuggestionStatus('idle');
    if (!product && initialType) requestSkuSuggestion(initialType);
    return () => { skuRequestRef.current += 1; selectedTypeRef.current = null; };
  }, [form, initialType, open, product, requestSkuSuggestion]);

  useEffect(() => {
    if (!imageFile) { setImagePreviewUrl(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const selectImage = (file?: File): void => {
    if (!file) return;
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setRemoveImage(false);
      setImageError(!IMAGE_TYPES.has(file.type) ? 'Chỉ chọn ảnh JPEG, PNG hoặc WebP.' : 'Ảnh không được vượt quá 5 MB.');
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    setImageError('');
    hasUserChangesRef.current = true;
  };

  const clearImage = (): void => {
    setImageFile(null);
    setRemoveImage(Boolean(product?.imageUpdatedAt));
    setImageError('');
    hasUserChangesRef.current = true;
  };

  const suggestSku = (requestedType: ProductType): void => {
    selectedTypeRef.current = requestedType;
    if (product || skuModeRef.current !== 'auto') return;
    requestSkuSuggestion(requestedType);
  };

  const skuHelp = skuMode === 'manual' ? 'Mã đã được chỉnh thủ công.'
    : skuSuggestionStatus === 'loading' ? <span role="status">Đang lấy mã gợi ý...</span>
      : skuSuggestionStatus === 'error' ? <span className="product-form-sku-feedback" role="alert">Không lấy được mã gợi ý. Nhập mã thủ công hoặc <Button type="link" size="small" onClick={() => { if (selectedTypeRef.current) requestSkuSuggestion(selectedTypeRef.current); }}>Thử lại</Button>.</span>
        : 'Tự tạo theo danh mục; bạn vẫn có thể sửa.';

  const submit = async (values: ProductInput): Promise<void> => {
    if (imageError) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      if (!product) createRequestKey.current ||= crypto.randomUUID();
      let saved = await onSubmit({
        ...values,
        autoSku: !product && skuMode === 'auto',
        ...(!product ? { idempotencyKey: createRequestKey.current } : {}),
      }, savedProductIdRef.current);
      savedProductIdRef.current = saved.id;
      if (!product && saved.sku !== values.sku) form.setFieldsValue({ sku: saved.sku });
      if (imageFile) saved = await uploadProductImage({ id: saved.id, file: imageFile }).unwrap();
      else if (removeImage && saved.imageUpdatedAt) saved = await removeProductImage(saved.id).unwrap();
      hasUserChangesRef.current = false;
      onSaved(saved);
    } catch (error: unknown) {
      message.error(savedProductIdRef.current ? `Thông tin sản phẩm đã lưu, nhưng ảnh chưa lưu: ${getErrorMessage(error)}. Hãy thử lưu lại.` : getErrorMessage(error));
    } finally {
      submittingRef.current = false;
    }
  };

  const requestClose = (): void => {
    if (isSaving || submittingRef.current || closeConfirmOpenRef.current) return;
    if (!hasUserChangesRef.current) {
      onClose();
      return;
    }
    closeConfirmOpenRef.current = true;
    Modal.confirm({
      className: 'customer-action-confirm product-form-confirm--discard',
      title: product ? 'Hủy chỉnh sửa sản phẩm?' : 'Hủy thêm sản phẩm?',
      content: savedProductIdRef.current ? 'Thông tin sản phẩm đã được lưu, nhưng ảnh chưa lưu. Thoát lúc này sẽ bỏ qua ảnh đã chọn.' : 'Những thông tin chưa lưu sẽ bị mất. Bạn có muốn thoát?',
      okText: 'Thoát, không lưu',
      okButtonProps: { danger: true },
      cancelText: 'Tiếp tục nhập',
      zIndex: (zIndex ?? 1000) + 100,
      onOk: onClose,
      afterClose: () => { closeConfirmOpenRef.current = false; },
    });
  };

  return <Modal
    className="product-form-modal"
    title={<div className="product-form-modal__title"><span>DANH MỤC SẢN PHẨM</span><strong>{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</strong><p>{product ? 'Cập nhật thông tin và giá bán của sản phẩm.' : 'Hoàn tất thông tin cơ bản để đưa sản phẩm vào danh mục.'}</p></div>}
    open={open}
    centered
    width={680}
    zIndex={zIndex}
    onCancel={requestClose}
    footer={<div className="product-form-modal__footer"><span>Các trường có <b>*</b> là bắt buộc</span><Space><Button onClick={requestClose}>Hủy</Button><Button type="primary" loading={isSaving} onClick={() => void form.submit()}>Lưu sản phẩm</Button></Space></div>}
  >
    <Form<ProductInput>
      className="product-form-modal__form"
      form={form}
      layout="vertical"
      onValuesChange={() => { hasUserChangesRef.current = true; }}
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
        <Form.Item name="sku" label={<>Mã sản phẩm <b className="product-form-required">*</b></>} extra={skuHelp} rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mã sản phẩm.' }]}>
          <Input maxLength={80} placeholder="VD: GONG-001" onChange={() => { skuModeRef.current = 'manual'; skuRequestRef.current += 1; setSkuMode('manual'); setSkuSuggestionStatus('idle'); }} />
        </Form.Item>
      </section>
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Ảnh sản phẩm</strong><span>Một ảnh chính để dễ nhận diện khi bán hàng, không bắt buộc.</span></div>
        <div className="product-form-image">
          <div className="product-form-image__preview">
            {previewSrc
              ? <Image unoptimized width={104} height={104} src={previewSrc} alt="Ảnh sản phẩm đang chọn" />
              : <PictureOutlined aria-hidden="true" />}
          </div>
          <div className="product-form-image__body">
            <div className="product-form-image__status">
              <strong>{imageFile ? 'Ảnh mới đã chọn' : savedImageUrl ? 'Ảnh hiện tại' : 'Chưa có ảnh'}</strong>
              <span title={imageFile?.name}>{imageFile ? imageFile.name : 'JPEG, PNG, WebP · tối đa 5 MB'}</span>
            </div>
            <div className="product-form-image__actions">
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="product-form-image__input" aria-label="Chọn ảnh sản phẩm" hidden style={{ display: 'none' }} onChange={(event) => selectImage(event.target.files?.[0])} />
              <Button className="product-form-image__choose" icon={<UploadOutlined />} disabled={isSaving} onClick={() => imageInputRef.current?.click()}>{imageFile || savedImageUrl ? 'Thay ảnh' : 'Chọn ảnh'}</Button>
              {(imageFile || savedImageUrl) && <Button className="product-form-image__remove" type="text" danger icon={<DeleteOutlined />} disabled={isSaving} onClick={clearImage}>Xóa ảnh</Button>}
            </div>
          </div>
        </div>
        <p className="product-form-image__note">Ảnh được lưu khi bấm Lưu sản phẩm.</p>
        {imageError && <p className="product-form-image__error" role="alert">{imageError} <Button type="link" size="small" onClick={() => setImageError('')}>Bỏ qua ảnh</Button></p>}
      </section>
      <section className="product-form-section">
        <div className="product-form-section__heading"><strong>Giá sản phẩm</strong><span>Đơn giá tính bằng Việt Nam đồng.</span></div>
        <div className="product-form-grid">
          <Form.Item name="costPrice" label={<>Giá vốn <b className="product-form-required">*</b></>} rules={wholeNumberRules('giá vốn')}><MoneyInput min={0} max={MAX_PRICE} precision={0} inputMode="numeric" formatter={formatVndInput} parser={wholeNumberParser} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
          <Form.Item name="salePrice" label={<>Giá bán <b className="product-form-required">*</b></>} rules={wholeNumberRules('giá bán')}><MoneyInput min={0} max={MAX_PRICE} precision={0} inputMode="numeric" formatter={formatVndInput} parser={wholeNumberParser} placeholder="0" {...integerOnlyInputProps} /></Form.Item>
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
