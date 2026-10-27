'use client';

import { CloseOutlined, PhoneOutlined, PlusOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Collapse, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Space, Spin, Tooltip, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { getErrorMessage, paymentMethodLabels, type Customer, type EyeExam, type Order, type OrderInput, type OrderType, type Product, useCreateCustomerMutation, useCustomerEyeExamsQuery, useCustomersQuery, useProductsQuery } from '@/store/api';
import { formatVndInput } from '@/lib/money-input';

interface OrderFormProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: OrderInput) => Promise<void>;
  mode?: 'create' | 'edit';
  order?: Order | null;
  initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
}

interface OrderLineInput {
  productId: string;
  qty: number;
}
interface QuickCustomerValues { name: string; phone: string; }
interface CustomerOption { id: string; name: string; phone: string; birthday?: string | null; address?: string | null; }

type DiscountMode = 'AMOUNT' | 'PERCENT';

interface OrderFormValues extends Omit<OrderInput, 'items' | 'discount'> {
  frameProductId?: string;
  lensItems?: OrderLineInput[];
  accessoryItems?: OrderLineInput[];
  discountMode?: DiscountMode;
  discountValue?: number;
}

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const productOption = (product: Product) => ({ value: product.id, label: product.name, product });
const renderProductOption = (option: { data: { product: Product } }) => {
  const product = option.data.product;
  return <div className="order-product-option"><strong>{product.name}</strong><span>{product.sku ? `${product.sku} · ` : ''}{formatMoney(product.salePrice)}</span></div>;
};
const integerParser = (value: string | undefined): number => {
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
const disablePastDates = (current: Dayjs): boolean => current.isBefore(dayjs().startOf('day'), 'day');

export function OrderForm({ open, loading, onClose, onSubmit, mode = 'create', order = null, initialCustomer = null }: OrderFormProps) {
  const [form] = Form.useForm<OrderFormValues>();
  const [quickCustomerForm] = Form.useForm<QuickCustomerValues>();
  const [customerQuery, setCustomerQuery] = useState('');
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('');
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<CustomerOption>();
  const [productQuery, setProductQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const customerSearchTerm = customerQuery.trim();
  const debouncedCustomerSearchTerm = debouncedCustomerQuery.trim();
  const isSearchingCustomers = customerSearchTerm.length >= 2;
  const { data: customers, isFetching: isFetchingCustomers } = useCustomersQuery({ q: debouncedCustomerSearchTerm, page: 1, pageSize: 20 }, { skip: debouncedCustomerSearchTerm.length < 2 });
  const [createCustomer, createCustomerState] = useCreateCustomerMutation();
  const { data: products } = useProductsQuery({ q: productQuery || undefined, page: 1, pageSize: 100 });
  const frameProductId = Form.useWatch('frameProductId', form);
  const lensItems = Form.useWatch('lensItems', form) ?? [];
  const accessoryItems = Form.useWatch('accessoryItems', form) ?? [];
  const customerId = Form.useWatch('customerId', form);
  const eyeExamId = Form.useWatch('eyeExamId', form);
  const discountMode = Form.useWatch('discountMode', form) ?? 'AMOUNT';
  const discountValue = Form.useWatch('discountValue', form) ?? 0;
  const deposit = Form.useWatch('deposit', form) ?? 0;
  const orderType = Form.useWatch('orderType', form) ?? 'PREORDER';
  const { data: eyeExams, isFetching: isFetchingEyeExams } = useCustomerEyeExamsQuery(customerId ?? '', { skip: !customerId });
  const activeProducts = useMemo(() => products?.items.filter((product) => product.active) ?? [], [products]);
  const initialProducts = useMemo(() => Object.fromEntries((order?.items ?? []).flatMap((item) => item.product ? [[item.product.id, { ...item.product, salePrice: item.unitPrice }]] : [])) as Record<string, Product>, [order]);
  const availableProducts = useMemo(() => [...new Map([...activeProducts, ...Object.values(selectedProducts)].map((product) => [product.id, product])).values()], [activeProducts, selectedProducts]);
  const frameProducts = availableProducts.filter((product) => product.type === 'FRAME');
  const lensProducts = availableProducts.filter((product) => product.type === 'LENS' || product.type === 'CONTACT');
  const accessoryProducts = availableProducts.filter((product) => product.type === 'ACCESSORY');
  const productById = useMemo(() => new Map(availableProducts.map((product) => [product.id, product])), [availableProducts]);
  const rememberProduct = useCallback((productId: string) => {
    const product = availableProducts.find((candidate) => candidate.id === productId);
    if (product) setSelectedProducts((current) => ({ ...current, [productId]: product }));
  }, [availableProducts]);
  const orderItems = [
    ...(frameProductId ? [{ productId: frameProductId, qty: 1 }] : []),
    ...lensItems,
    ...accessoryItems,
  ].filter((item): item is OrderLineInput => Boolean(item?.productId && item.qty > 0));
  const needsPrescription = lensItems.some((item) => Boolean(item?.productId));
  const finalizedEyeExams = eyeExams?.filter((exam) => Boolean(exam.lockedAt)) ?? [];
  const selectedEyeExam = finalizedEyeExams.find((exam) => exam.id === eyeExamId);
  const subtotal = orderItems.reduce((sum, item) => {
    const product = productById.get(item?.productId ?? '');
    return sum + (product?.salePrice ?? 0) * (item?.qty ?? 0);
  }, 0);
  const discount = discountMode === 'PERCENT'
    ? Math.round(subtotal * discountValue / 100)
    : discountValue;
  const discountLimit = discountMode === 'PERCENT' ? 100 : subtotal;
  const total = Math.max(0, subtotal - discount);
  const receivedAmount = mode === 'edit'
    ? (order?.deposit ?? 0) + (order?.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0) ?? 0)
    : deposit;
  const remainingBalance = Math.max(0, total - receivedAmount);
  const isReadySale = mode === 'create' && orderType === 'READY_SALE';
  const summaryItems = orderItems.flatMap((item) => {
    const product = productById.get(item.productId);
    return product ? [{ ...item, product }] : [];
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerQuery(customerQuery), 300);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);
  useEffect(() => {
    if (open) {
      const currentItems = order?.items ?? [];
      const frameItem = currentItems.find((item) => item.product?.type === 'FRAME');
      const lensOrderItems = currentItems.filter((item) => item.product?.type === 'LENS' || item.product?.type === 'CONTACT').map((item) => ({ productId: item.productId ?? '', qty: item.qty }));
      const accessoryOrderItems = currentItems.filter((item) => item.product?.type === 'ACCESSORY').map((item) => ({ productId: item.productId ?? '', qty: item.qty }));
      setSelectedProducts(mode === 'edit' ? initialProducts : {});
      setProductQuery('');
      setCustomerQuery('');
      setSelectedCustomerOption(mode === 'edit' && order ? order.customer : initialCustomer ?? undefined);
      form.setFieldsValue(mode === 'edit' && order ? {
        orderType: order.orderType, customerId: order.customerId, eyeExamId: order.eyeExamId, frameProductId: frameItem?.productId ?? undefined, lensItems: lensOrderItems, accessoryItems: accessoryOrderItems, discountMode: 'AMOUNT', discountValue: order.discount, deposit: order.deposit, depositMethod: order.depositMethod ?? 'CASH', dueDate: order.dueDate ?? undefined, warrantyUntil: order.warrantyUntil ?? undefined, note: order.note ?? '',
      } : { orderType: 'PREORDER', customerId: initialCustomer?.id, eyeExamId: undefined, frameProductId: undefined, lensItems: [], accessoryItems: [], discountMode: 'AMOUNT', discountValue: 0, deposit: 0, depositMethod: 'CASH', dueDate: undefined, warrantyUntil: undefined, note: '' });
    }
  }, [form, initialCustomer?.id, initialProducts, mode, open, order]);
  useEffect(() => {
    if (mode === 'create' && orderType === 'READY_SALE') form.setFieldsValue({ deposit: total, dueDate: undefined });
  }, [form, mode, orderType, total]);
  useEffect(() => { if (quickCustomerOpen) quickCustomerForm.resetFields(); }, [quickCustomerForm, quickCustomerOpen]);

  const previousCustomerId = useMemo(() => order?.customerId, [order?.customerId]);
  useEffect(() => {
    if (customerId && customerId !== previousCustomerId) form.setFieldValue('eyeExamId', undefined);
  }, [customerId, form, previousCustomerId]);

  const selectNumericValue = (event: FocusEvent<HTMLInputElement>): void => {
    event.currentTarget.select();
  };

  const submit = async (values: OrderFormValues): Promise<void> => {
    await onSubmit({
      ...(mode === 'create' ? { orderType: values.orderType as OrderType | undefined } : {}),
      customerId: values.customerId,
      eyeExamId: values.eyeExamId,
      items: orderItems,
      discount: values.discountMode === 'PERCENT'
        ? Math.round(subtotal * (values.discountValue ?? 0) / 100)
        : values.discountValue ?? 0,
      deposit: values.deposit,
      depositMethod: values.depositMethod,
      dueDate: values.dueDate,
      warrantyUntil: values.warrantyUntil,
      note: values.note,
    });
  };
  const createQuickCustomer = async (values: QuickCustomerValues): Promise<void> => {
    try {
      const customer = await createCustomer(values).unwrap();
      form.setFieldsValue({ customerId: customer.id, eyeExamId: undefined });
      setCustomerQuery('');
      setSelectedCustomerOption(customer);
      setQuickCustomerOpen(false);
      message.success('Đã thêm và chọn khách hàng.');
    } catch (error: unknown) { message.error(getErrorMessage(error)); }
  };
  const customerOptions = useMemo(() => {
    const searchResults = isSearchingCustomers ? (customers?.items ?? []) : [];
    const currentCustomer = selectedCustomerOption ?? (mode === 'edit' ? order?.customer : initialCustomer);
    const allCustomers = currentCustomer && !searchResults.some((customer) => customer.id === currentCustomer.id)
      ? [currentCustomer, ...searchResults]
      : searchResults;
    return allCustomers.map((customer) => ({ value: customer.id, label: `${customer.name} — ${customer.phone}`, customer }));
  }, [customers?.items, initialCustomer, isSearchingCustomers, mode, order?.customer, selectedCustomerOption]);

  return <Modal
    className="order-form-modal"
    open={open}
    centered
    width={1040}
    title={<div className="order-form-modal__title"><strong>{mode === 'edit' ? `Sửa đơn hàng ${order?.code ?? ''}` : isReadySale ? 'Bán hàng có sẵn' : 'Tạo đơn đặt trước'}</strong><span>{isReadySale ? 'Khách hàng → Sản phẩm có sẵn → Thanh toán đủ' : 'Khách hàng → Sản phẩm → Cọc / hẹn giao'}</span></div>}
    onCancel={onClose}
    footer={<Space><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={loading} onClick={() => void form.submit()}>{mode === 'edit' ? 'Lưu thay đổi' : total > 0 ? isReadySale ? `Thanh toán & hoàn tất · ${formatMoney(total)}` : `Tạo đơn đặt trước · ${formatMoney(total)}` : isReadySale ? 'Thanh toán & hoàn tất' : 'Tạo đơn đặt trước'}</Button></Space>}
  >
    <Form<OrderFormValues> form={form} layout="vertical" requiredMark="optional" validateTrigger="onSubmit" onFinish={submit}>
      <div className="order-form__workspace">
        <main className="order-form__main">
      {mode === 'create' ? <section className="order-form__type"><div className="order-form__heading"><strong>Loại giao dịch</strong><span>Chọn đúng luồng trước khi nhập sản phẩm và thanh toán.</span></div><Form.Item name="orderType" noStyle><Radio.Group className="order-form__type-options"><Radio.Button value="PREORDER"><strong>Đặt trước / gia công</strong><span>Nhận cọc, hẹn giao và theo dõi tiến độ.</span></Radio.Button><Radio.Button value="READY_SALE"><strong>Bán hàng có sẵn</strong><span>Thu đủ tiền, giao hàng và hoàn tất ngay.</span></Radio.Button></Radio.Group></Form.Item></section> : null}
      <section className="order-form__customer">
        <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng.' }]}>
          <Select
            showSearch
            searchValue={customerQuery}
            filterOption={false}
            onSearch={setCustomerQuery}
            onSelect={(value) => { setSelectedCustomerOption(customerOptions.find((option) => option.value === value)?.customer); setCustomerQuery(''); }}
            onOpenChange={(visible) => { if (!visible) setCustomerQuery(''); }}
            placeholder="Nhập ít nhất 2 ký tự để tìm khách hàng"
            options={customerOptions}
            optionRender={(option) => {
              const customer = option.data.customer as CustomerOption;
              return <div className="order-customer-option"><strong>{customer.name}</strong><div className="order-customer-option__meta"><span className="order-customer-option__phone"><PhoneOutlined />{customer.phone}</span>{customer.birthday ? <span>Sinh {new Intl.DateTimeFormat('vi-VN').format(new Date(customer.birthday))}</span> : null}{customer.address ? <span>{customer.address}</span> : null}</div></div>;
            }}
            listHeight={300}
            classNames={{ popup: { root: 'order-customer-select-dropdown' } }}
            notFoundContent={customerSearchTerm.length < 2 ? <div className="order-customer-select__empty">Nhập tên hoặc số điện thoại để tìm khách hàng</div> : customerSearchTerm !== debouncedCustomerSearchTerm || isFetchingCustomers ? <div className="order-customer-select__loading"><Spin size="small" />Đang tìm khách hàng…</div> : <div className="order-customer-select__empty">Không tìm thấy khách hàng phù hợp</div>}
            popupRender={(menu) => <><div className="order-customer-select__results">{isSearchingCustomers && !isFetchingCustomers && customers ? `Tìm thấy ${customers.total} khách hàng · hiển thị tối đa 20 kết quả` : 'Tìm khách hàng theo tên hoặc số điện thoại'}</div>{menu}<div className="order-customer-select__footer"><Button type="link" icon={<UserAddOutlined />} onClick={() => setQuickCustomerOpen(true)}>Thêm khách hàng nhanh</Button></div></>}
          />
        </Form.Item>
      </section>
      <section className="order-form__items">
        <div className="order-form__heading"><strong>Gọng kính</strong><span>Có thể để trống với đơn chỉ bán tròng hoặc kính áp tròng.</span></div>
        <Form.Item name="frameProductId" rules={[{ validator: async (_rule, value: string | undefined) => { if (!value && !lensItems.some((item) => item?.productId) && !accessoryItems.some((item) => item?.productId)) throw new Error('Chọn ít nhất một gọng, tròng hoặc phụ kiện.'); } }]}>
          <Select showSearch allowClear filterOption={false} onSearch={setProductQuery} onSelect={rememberProduct} placeholder="Chọn gọng kính" options={frameProducts.map(productOption)} optionRender={renderProductOption} classNames={{ popup: { root: 'order-product-select-dropdown' } }} />
        </Form.Item>
      </section>
      <Form.List name="lensItems">
        {(fields, { add, remove }) => <section className="order-form__items order-form__items--lens">
          <div className="order-form__heading"><strong>Tròng kính / Kính áp tròng</strong><span>Chọn tròng hoặc kính áp tròng theo phiếu đo mắt đã chọn.</span></div>
          {fields.map((field) => <div className="order-form__item" key={field.key}>
            <Form.Item name={[field.name, 'productId']} rules={[{ required: true, message: 'Chọn tròng hoặc kính áp tròng.' }]}>
              <Select showSearch filterOption={false} onSearch={setProductQuery} onSelect={rememberProduct} placeholder="Chọn tròng hoặc kính áp tròng" options={lensProducts.map(productOption)} optionRender={renderProductOption} classNames={{ popup: { root: 'order-product-select-dropdown' } }} />
            </Form.Item>
            <div className="order-form__quantity"><span>SL</span><Form.Item name={[field.name, 'qty']} rules={[{ required: true, message: 'Nhập SL.' }, { type: 'number', min: 1, message: 'SL từ 1.' }]}><InputNumber controls={false} min={1} precision={0} inputMode="numeric" parser={integerParser} {...integerOnlyInputProps} /></Form.Item></div>
            <Tooltip title="Xóa sản phẩm"><Button className="order-form__remove-item" aria-label="Xóa tròng hoặc kính áp tròng" type="text" icon={<CloseOutlined />} onClick={() => remove(field.name)} /></Tooltip>
          </div>)}
          <Button className="order-form__add-item" icon={<PlusOutlined />} onClick={() => add({ productId: '', qty: 1 })}>Thêm tròng / kính áp tròng</Button>
        </section>}
      </Form.List>
      <Form.List name="accessoryItems">
        {(fields, { add, remove }) => <section className="order-form__items order-form__items--accessory">
          <div className="order-form__heading"><strong>Phụ kiện</strong><span>Thêm hộp, khăn lau hoặc sản phẩm đi kèm nếu có.</span></div>
          {fields.map((field) => <div className="order-form__item" key={field.key}>
            <Form.Item name={[field.name, 'productId']} rules={[{ required: true, message: 'Chọn phụ kiện.' }]}>
              <Select showSearch filterOption={false} onSearch={setProductQuery} onSelect={rememberProduct} placeholder="Chọn phụ kiện" options={accessoryProducts.map(productOption)} optionRender={renderProductOption} classNames={{ popup: { root: 'order-product-select-dropdown' } }} />
            </Form.Item>
            <div className="order-form__quantity"><span>SL</span><Form.Item name={[field.name, 'qty']} rules={[{ required: true, message: 'Nhập SL.' }, { type: 'number', min: 1, message: 'SL từ 1.' }]}><InputNumber controls={false} min={1} precision={0} inputMode="numeric" parser={integerParser} {...integerOnlyInputProps} /></Form.Item></div>
            <Tooltip title="Xóa sản phẩm"><Button className="order-form__remove-item" aria-label="Xóa phụ kiện" type="text" icon={<CloseOutlined />} onClick={() => remove(field.name)} /></Tooltip>
          </div>)}
          <Button className="order-form__add-item" icon={<PlusOutlined />} onClick={() => add({ productId: '', qty: 1 })}>Thêm phụ kiện</Button>
        </section>}
      </Form.List>
      {needsPrescription ? <section className="order-form__prescription"><div className="order-form__heading"><strong>Phiếu đo mắt (Rx)</strong><span>Bắt buộc vì đơn có tròng kính hoặc kính áp tròng.</span></div><Form.Item name="eyeExamId" rules={[{ required: true, message: 'Đơn có tròng kính cần chọn phiếu đo mắt.' }]}><Select disabled={!customerId} loading={isFetchingEyeExams} placeholder={customerId ? 'Chọn phiếu đo mắt của khách' : 'Chọn khách hàng trước'} options={finalizedEyeExams.map((exam: EyeExam) => ({ value: exam.id, label: new Intl.DateTimeFormat('vi-VN').format(new Date(exam.examDate)) }))} notFoundContent={customerId ? 'Khách chưa có phiếu đo đã chốt.' : null} /></Form.Item>{selectedEyeExam ? <div className="order-form__rx-preview"><div><strong>Rx sẽ được khóa vào đơn</strong><span>Đo ngày {new Intl.DateTimeFormat('vi-VN').format(new Date(selectedEyeExam.examDate))}</span></div><div className="order-form__rx-values">{selectedEyeExam.noPrescription ? <span>Phiếu này không kê đơn kính{selectedEyeExam.noPrescriptionReason ? `: ${selectedEyeExam.noPrescriptionReason}` : ''}.</span> : <><span>MP: SPH {selectedEyeExam.rSph ?? '—'} · CYL {selectedEyeExam.rCyl ?? '—'} · AXIS {selectedEyeExam.rAxis ?? '—'}</span><span>MT: SPH {selectedEyeExam.lSph ?? '—'} · CYL {selectedEyeExam.lCyl ?? '—'} · AXIS {selectedEyeExam.lAxis ?? '—'}</span>{selectedEyeExam.pdTotal !== null ? <span>PD tổng: {selectedEyeExam.pdTotal} mm</span> : null}</>}</div></div> : null}</section> : null}
      <Collapse className="order-form__optional" size="small" items={[{ key: 'aftercare', label: 'Tùy chọn: bảo hành & ghi chú', children: <><Form.Item name="warrantyUntil" label="Hạn bảo hành" getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })} normalize={(value: Dayjs | null) => value?.format('YYYY-MM-DD')}><DatePicker allowClear disabledDate={disablePastDates} format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" style={{ width: '100%' }} /></Form.Item><Form.Item name="note" label="Ghi chú" style={{ marginBottom: 0 }}><Input.TextArea rows={3} maxLength={500} placeholder="Ghi chú cho đơn hàng (không bắt buộc)" /></Form.Item></> }]} />
        </main>
        <aside className="order-form__summary">
          <div className="order-form__summary-heading"><strong>Tóm tắt đơn</strong><span>{summaryItems.length ? `${summaryItems.length} sản phẩm đã chọn` : 'Chưa có sản phẩm'}</span></div>
          <div className="order-form__summary-items">{summaryItems.length ? summaryItems.map((item) => <div key={`${item.productId}-${item.qty}`}><span>{item.product.name} <b>× {item.qty}</b></span><strong>{formatMoney(item.product.salePrice * item.qty)}</strong></div>) : <p>Thêm gọng, tròng hoặc phụ kiện để xem tổng tiền.</p>}</div>
          <div className="order-form__summary-controls">
            <Form.Item label="Chiết khấu" extra={discountMode === 'PERCENT' ? `Tương đương ${formatMoney(discount)}.` : undefined}><div className="order-form__discount-control"><Form.Item name="discountValue" noStyle dependencies={['discountMode']} rules={[{ type: 'number', min: 0, max: discountLimit, message: discountMode === 'PERCENT' ? 'Chiết khấu phần trăm từ 0 đến 100.' : `Chiết khấu không vượt quá ${formatMoney(subtotal)}.` }]}><InputNumber controls={false} min={0} max={discountLimit} precision={0} inputMode="numeric" parser={integerParser} onFocus={selectNumericValue} placeholder="0" style={{ width: '100%' }} {...integerOnlyInputProps} /></Form.Item><Form.Item name="discountMode" noStyle><Select className="order-form__discount-mode" options={[{ value: 'AMOUNT', label: 'VNĐ' }, { value: 'PERCENT', label: '%' }]} /></Form.Item></div><Form.Item noStyle shouldUpdate>{() => <Form.ErrorList errors={form.getFieldError('discountValue')} />}</Form.Item></Form.Item>
            {mode === 'edit' ? <div className="order-form__paid"><span>Đã nhận</span><strong>{formatMoney(receivedAmount)}</strong></div> : <>{isReadySale ? <><Form.Item name="deposit" label="Thanh toán khi bán (đ)"><InputNumber disabled precision={0} formatter={formatVndInput} style={{ width: '100%' }} /></Form.Item><Form.Item name="depositMethod" label="Hình thức thanh toán" rules={[{ required: true, message: 'Chọn hình thức thanh toán.' }]}><Select options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item><p className="order-form__ready-sale-note">Đơn sẽ được thanh toán đủ và chuyển sang “Đã giao” ngay khi tạo.</p></> : <><Form.Item name="deposit" label="Tiền cọc (đ)" rules={[{ type: 'number', min: 0, message: 'Tiền cọc không hợp lệ.' }]}><InputNumber min={0} precision={0} inputMode="numeric" formatter={formatVndInput} parser={integerParser} onFocus={selectNumericValue} style={{ width: '100%' }} {...integerOnlyInputProps} /></Form.Item>{deposit > 0 ? <Form.Item name="depositMethod" label="Hình thức cọc" rules={[{ required: true, message: 'Chọn hình thức nhận cọc.' }]}><Select options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item> : null}<Form.Item name="dueDate" label="Ngày hẹn giao" getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })} normalize={(value: Dayjs | null) => value?.format('YYYY-MM-DD')}><DatePicker allowClear disabledDate={disablePastDates} format="DD/MM/YYYY" placeholder="Chọn ngày hẹn giao" style={{ width: '100%' }} /></Form.Item></>}</>}
          </div>
          <div className="order-form__total"><span>Tạm tính <b>{formatMoney(subtotal)}</b></span>{discount > 0 ? <span>Chiết khấu <b>−{formatMoney(discount)}</b></span> : null}<strong>Tổng đơn <b>{formatMoney(total)}</b></strong><em>{isReadySale ? 'Thanh toán đủ và hoàn tất đơn ngay' : `Còn cần thu ${formatMoney(remainingBalance)}`}</em></div>
        </aside>
      </div>
    </Form>
    <Modal className="quick-customer-modal" open={quickCustomerOpen} centered destroyOnHidden title={<div className="quick-customer-modal__heading"><span><UserAddOutlined /></span><div><strong>Thêm khách hàng nhanh</strong><p>Chỉ cần thông tin liên hệ để tạo đơn.</p></div></div>} onCancel={() => setQuickCustomerOpen(false)} footer={<Space size={10}><Button onClick={() => setQuickCustomerOpen(false)}>Hủy</Button><Button type="primary" loading={createCustomerState.isLoading} onClick={() => void quickCustomerForm.submit()}>Tạo và chọn khách</Button></Space>}>
      <Form<QuickCustomerValues> className="quick-customer-modal__form" form={quickCustomerForm} layout="vertical" onFinish={createQuickCustomer}>
        <Form.Item name="name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên.' }]}><Input autoFocus autoComplete="name" maxLength={120} placeholder="Nguyễn Văn A" prefix={<UserOutlined />} /></Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại.' }, { pattern: /^[+\d.\-\s()]+$/, message: 'Số điện thoại không hợp lệ.' }]}><Input autoComplete="tel" inputMode="tel" maxLength={30} placeholder="0901 234 567" type="tel" /></Form.Item>
        <p>Ngày sinh, địa chỉ và ghi chú có thể bổ sung sau trong hồ sơ khách hàng.</p>
      </Form>
    </Modal>
  </Modal>;
}
