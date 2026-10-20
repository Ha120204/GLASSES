'use client';

import { Button, Form, Input, InputNumber, Modal, Select, Space, message } from 'antd';
import { useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';
import { getErrorMessage, type Product, type StockMovementInput, useCreateStockMovementMutation } from '@/store/api';

const wholeNumberParser = (value: string | undefined): number => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};
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

interface StockMovementFormProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onSuccess: (product: Product) => void;
}

export function StockMovementForm({ product, open, onClose, onSuccess }: StockMovementFormProps) {
  const [form] = Form.useForm<StockMovementInput>();
  const [messageApi, contextHolder] = message.useMessage();
  const [createMovement, { isLoading }] = useCreateStockMovementMutation();
  const movementType = Form.useWatch('type', form);

  useEffect(() => {
    if (open) form.resetFields(['type', 'qty', 'adjustmentDirection', 'note']);
  }, [form, open]);

  const submit = async (values: StockMovementInput): Promise<void> => {
    try {
      const result = await createMovement({ id: product.id, data: values }).unwrap();
      messageApi.success('Đã cập nhật tồn kho.');
      onSuccess(result.product);
      onClose();
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  return <Modal
    className="stock-movement-modal"
    open={open}
    centered
    title={<div><span className="product-drawer__eyebrow">BIẾN ĐỘNG KHO</span><strong>{product.name}</strong><span className="stock-movement-modal__stock">Tồn hiện tại: <b>{product.stockQty}</b></span></div>}
    onCancel={onClose}
    footer={<Space><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={isLoading} onClick={() => void form.submit()}>Lưu biến động</Button></Space>}
  >
    {contextHolder}
    <Form<StockMovementInput> form={form} layout="vertical" onFinish={submit} requiredMark="optional">
      <Form.Item name="type" label="Loại biến động" rules={[{ required: true, message: 'Vui lòng chọn loại biến động.' }]}>
        <Select placeholder="Chọn thao tác" options={[
          { value: 'IN', label: 'Nhập kho' },
          { value: 'OUT', label: 'Xuất kho' },
          { value: 'ADJUST', label: 'Điều chỉnh tồn kho' },
        ]} />
      </Form.Item>
      {movementType === 'ADJUST' && <Form.Item name="adjustmentDirection" label="Hướng điều chỉnh" rules={[{ required: true, message: 'Vui lòng chọn hướng điều chỉnh.' }]}>
        <Select placeholder="Chọn tăng hoặc giảm" options={[{ value: 'IN', label: 'Điều chỉnh tăng' }, { value: 'OUT', label: 'Điều chỉnh giảm' }]} />
      </Form.Item>}
      <Form.Item name="qty" label="Số lượng" rules={[{ required: true, message: 'Vui lòng nhập số lượng.' }, { type: 'number', min: 1, message: 'Số lượng phải là số nguyên lớn hơn 0.' }]}>
        <InputNumber<number> min={1} precision={0} inputMode="numeric" parser={wholeNumberParser} style={{ width: '100%' }} placeholder="Nhập số lượng" {...integerOnlyInputProps} />
      </Form.Item>
      <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} maxLength={500} placeholder="Ví dụ: Nhập từ nhà cung cấp, hàng lỗi, kiểm kho..." /></Form.Item>
    </Form>
  </Modal>;
}
