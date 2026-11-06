'use client';

import { DeleteOutlined, ExclamationCircleFilled, PhoneOutlined, PlusOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Collapse, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Space, Spin, Tooltip, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { formatAxis, formatDiopter } from '@glasses/shared';
import { getErrorMessage, paymentMethodLabels, type Customer, type EyeExam, type EyeExamInput, type Order, type OrderInput, type OrderType, type Product, type ProductInput, type ProductType, useCreateCustomerMutation, useCreateEyeExamMutation, useCreateProductMutation, useCustomerEyeExamsQuery, useCustomersQuery, useFinalizeEyeExamMutation, useProductsQuery, useUpdateProductMutation } from '@/store/api';
import { formatVndInput } from '@/lib/money-input';
import { validateCustomerName } from '@/lib/customer-name';
import { validateVietnamPhone } from '@/lib/phone';
import { ProductForm } from '@/components/product-form';
import { ProductImage } from '@/components/product-image';
import { EyeExamForm } from '@/components/eye-exam-form';

interface OrderFormProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: OrderInput) => Promise<void>;
  mode?: 'create' | 'edit';
  order?: Order | null;
  initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
  initialEyeExamId?: string;
}

interface OrderLineInput {
  productId: string;
  qty: number;
}
interface QuickCustomerValues { name: string; phone: string; }
interface CustomerOption { id: string; name: string; phone: string; birthday?: string | null; address?: string | null; }
interface QuickProductTarget { type: ProductType; list: 'frameItems' | 'lensItems' | 'accessoryItems'; index: number; }

type DiscountMode = 'AMOUNT' | 'PERCENT';

interface OrderFormValues extends Omit<OrderInput, 'idempotencyKey' | 'items' | 'discount'> {
  frameItems?: OrderLineInput[];
  lensItems?: OrderLineInput[];
  accessoryItems?: OrderLineInput[];
  discountMode?: DiscountMode;
  discountValue?: number;
}

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const productOption = (product: Product) => ({ value: product.id, label: product.name, product });
const renderProductOption = (option: { data: { product: Product } }) => {
  const product = option.data.product;
  return <div className="order-product-option">
    <ProductImage product={product} size="option" />
    <div className="order-product-option__content"><strong>{product.name}</strong><span>{product.sku} · {formatMoney(product.salePrice)}</span></div>
  </div>;
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
const formatExamDate = (examDate: string): string => new Intl.DateTimeFormat('vi-VN').format(new Date(examDate));
const formatEyeSummary = (exam: EyeExam, eye: 'right' | 'left'): string => {
  const label = eye === 'right' ? 'MP' : 'MT';
  const sph = eye === 'right' ? exam.rSph : exam.lSph;
  const cyl = eye === 'right' ? exam.rCyl : exam.lCyl;
  const axis = eye === 'right' ? exam.rAxis : exam.lAxis;
  return `${label}: SPH ${formatDiopter(sph)} · CYL ${formatDiopter(cyl)} · AXIS ${formatAxis(axis)}`;
};
const formatExamSelectLabel = (exam: EyeExam): string => exam.noPrescription
  ? `${exam.code} · ${formatExamDate(exam.examDate)} · Không kê đơn kính`
  : `${exam.code} · ${formatExamDate(exam.examDate)} · MP SPH ${formatDiopter(exam.rSph)} · MT SPH ${formatDiopter(exam.lSph)}`;

export function OrderForm({ open, loading, onClose, onSubmit, mode = 'create', order = null, initialCustomer = null, initialEyeExamId }: OrderFormProps) {
  const [form] = Form.useForm<OrderFormValues>();
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [quickCustomerForm] = Form.useForm<QuickCustomerValues>();
  const [customerQuery, setCustomerQuery] = useState('');
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('');
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<CustomerOption>();
  const [productQuery, setProductQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickProductTarget, setQuickProductTarget] = useState<QuickProductTarget | null>(null);
  const [quickEyeExamOpen, setQuickEyeExamOpen] = useState(false);
  const customerSearchTerm = customerQuery.trim();
  const debouncedCustomerSearchTerm = debouncedCustomerQuery.trim();
  const isSearchingCustomers = customerSearchTerm.length >= 2;
  const { data: customers, isFetching: isFetchingCustomers } = useCustomersQuery({ q: debouncedCustomerSearchTerm, page: 1, pageSize: 20 }, { skip: debouncedCustomerSearchTerm.length < 2 });
  const [createCustomer, createCustomerState] = useCreateCustomerMutation();
  const [createProduct, createProductState] = useCreateProductMutation();
  const [updateProduct, updateProductState] = useUpdateProductMutation();
  const [createEyeExam, createEyeExamState] = useCreateEyeExamMutation();
  const [finalizeEyeExam, finalizeEyeExamState] = useFinalizeEyeExamMutation();
  const { currentData: products, isFetching: isFetchingProducts } = useProductsQuery({ q: productQuery || undefined, page: 1, pageSize: 100 });
  const frameItems = Form.useWatch('frameItems', form) ?? [];
  const lensItems = Form.useWatch('lensItems', form) ?? [];
  const accessoryItems = Form.useWatch('accessoryItems', form) ?? [];
  const customerId = Form.useWatch('customerId', form);
  const eyeExamId = Form.useWatch('eyeExamId', form);
  const discountMode = Form.useWatch('discountMode', form) ?? 'AMOUNT';
  const discountValue = Form.useWatch('discountValue', form) ?? 0;
  const deposit = Form.useWatch('deposit', form) ?? 0;
  const depositMethod = Form.useWatch('depositMethod', form);
  const orderType = Form.useWatch('orderType', form) ?? 'PREORDER';
  const { data: eyeExams, isFetching: isFetchingEyeExams } = useCustomerEyeExamsQuery(customerId ?? '', { skip: !customerId });
  const activeProducts = useMemo(() => products?.items.filter((product) => product.active) ?? [], [products]);
  const initialProducts = useMemo(() => Object.fromEntries((order?.items ?? []).flatMap((item) => item.product ? [[item.product.id, { ...item.product, salePrice: item.unitPrice }]] : [])) as Record<string, Product>, [order]);
  const availableProducts = useMemo(() => [...new Map([...activeProducts, ...Object.values(selectedProducts)].map((product) => [product.id, product])).values()], [activeProducts, selectedProducts]);
  const optionProducts = productQuery.trim() ? activeProducts : availableProducts;
  const frameProducts = optionProducts.filter((product) => product.type === 'FRAME');
  const lensProducts = optionProducts.filter((product) => product.type === 'LENS' || product.type === 'CONTACT');
  const accessoryProducts = optionProducts.filter((product) => product.type === 'ACCESSORY');
  const productById = useMemo(() => new Map(availableProducts.map((product) => [product.id, product])), [availableProducts]);
  const productNotFoundContent = isFetchingProducts ? <span>Đang tìm sản phẩm...</span> : <span>Không tìm thấy sản phẩm phù hợp</span>;
  const renderSelectedProduct = ({ value, label }: { value?: string | number; label?: ReactNode }): ReactNode => {
    const product = productById.get(String(value));
    return product ? <div className="order-product-selected"><ProductImage product={product} size="selected" /><span>{product.name}</span></div> : label;
  };
  const rememberProduct = useCallback((productId: string) => {
    const product = availableProducts.find((candidate) => candidate.id === productId);
    if (product) setSelectedProducts((current) => ({ ...current, [productId]: product }));
  }, [availableProducts]);
  const selectProduct = useCallback((productId: string): void => {
    rememberProduct(productId);
    setProductQuery('');
    // This error belongs to the list rather than any particular category.
    // Remove it immediately when an order becomes valid.
    form.setFields([{ name: ['frameItems'], errors: [] }]);
  }, [form, rememberProduct]);
  const orderItems = [
    ...frameItems,
    ...lensItems,
    ...accessoryItems,
  ].filter((item): item is OrderLineInput => Boolean(item?.productId && item.qty > 0));
  const needsPrescription = lensItems.some((item) => Boolean(item?.productId));
  const finalizedEyeExams = eyeExams?.filter((exam) => Boolean(exam.lockedAt)) ?? [];
  const selectedEyeExam = finalizedEyeExams.find((exam) => exam.id === eyeExamId);
  const eyeExamOptions = finalizedEyeExams.map((exam) => ({ value: exam.id, label: formatExamSelectLabel(exam), exam }));
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
  const isReadySaleTransfer = isReadySale && depositMethod === 'TRANSFER' && total > 0;
  const summaryItems = [...orderItems.reduce((items, item) => {
    const product = productById.get(item.productId);
    if (!product) return items;
    const existing = items.get(item.productId);
    if (existing) existing.qty += item.qty;
    else items.set(item.productId, { productId: item.productId, qty: item.qty, product });
    return items;
  }, new Map<string, OrderLineInput & { product: Product }>()).values()];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerQuery(customerQuery), 300);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);
  useEffect(() => {
    if (open) {
      const currentItems = order?.items ?? [];
      const frameOrderItems = currentItems.filter((item) => item.product?.type === 'FRAME').map((item) => ({ productId: item.productId ?? '', qty: item.qty }));
      const lensOrderItems = currentItems.filter((item) => item.product?.type === 'LENS' || item.product?.type === 'CONTACT').map((item) => ({ productId: item.productId ?? '', qty: item.qty }));
      const accessoryOrderItems = currentItems.filter((item) => item.product?.type === 'ACCESSORY').map((item) => ({ productId: item.productId ?? '', qty: item.qty }));
      setSelectedProducts(mode === 'edit' ? initialProducts : {});
      setProductQuery('');
      setCustomerQuery('');
      setSelectedCustomerOption(mode === 'edit' && order ? order.customer : initialCustomer ?? undefined);
      form.setFieldsValue(mode === 'edit' && order ? {
        orderType: order.orderType, customerId: order.customerId, eyeExamId: order.eyeExamId, frameItems: frameOrderItems, lensItems: lensOrderItems, accessoryItems: accessoryOrderItems, discountMode: 'AMOUNT', discountValue: order.discount, deposit: order.deposit, depositMethod: order.depositMethod ?? undefined, dueDate: order.dueDate ?? undefined, warrantyUntil: order.warrantyUntil ?? undefined, note: order.note ?? '',
      } : { orderType: 'PREORDER', customerId: initialCustomer?.id, eyeExamId: initialEyeExamId, frameItems: [], lensItems: [], accessoryItems: [], discountMode: 'AMOUNT', discountValue: 0, deposit: 0, depositMethod: undefined, dueDate: undefined, warrantyUntil: undefined, note: '' });
    }
  }, [form, initialCustomer?.id, initialEyeExamId, initialProducts, mode, open, order]);
  useEffect(() => {
    if (mode === 'create' && orderType === 'READY_SALE') form.setFieldsValue({ deposit: total, dueDate: undefined });
  }, [form, mode, orderType, total]);
  useEffect(() => { if (quickCustomerOpen) quickCustomerForm.resetFields(); }, [quickCustomerForm, quickCustomerOpen]);

  const selectNumericValue = (event: FocusEvent<HTMLInputElement>): void => {
    event.currentTarget.select();
  };

  const submit = async (values: OrderFormValues): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    requestKey.current ??= crypto.randomUUID();
    try { await onSubmit({
      idempotencyKey: requestKey.current,
      ...(mode === 'create' ? { orderType: values.orderType as OrderType | undefined } : {}),
      customerId: values.customerId,
      eyeExamId: values.eyeExamId,
      items: orderItems,
      discount: values.discountMode === 'PERCENT'
        ? Math.round(subtotal * (values.discountValue ?? 0) / 100)
        : values.discountValue ?? 0,
      deposit: isReadySaleTransfer ? 0 : values.deposit,
      depositMethod: values.depositMethod,
      ...(isReadySaleTransfer ? { awaitingTransferPayment: true } : {}),
      dueDate: values.dueDate,
      warrantyUntil: values.warrantyUntil,
      note: values.note,
    }); } finally { submitting.current = false; }
  };
  const createQuickCustomer = async (values: QuickCustomerValues): Promise<void> => {
    try {
      const customer = await createCustomer(values).unwrap();
      requestKey.current = null;
      form.setFieldsValue({ customerId: customer.id, eyeExamId: undefined });
      setCustomerQuery('');
      setSelectedCustomerOption(customer);
      setQuickCustomerOpen(false);
      message.success('Đã thêm và chọn khách hàng.');
    } catch (error: unknown) { message.error(getErrorMessage(error)); }
  };
  const createQuickProduct = async (values: ProductInput, savedProductId: string | null): Promise<Product> => {
    if (savedProductId) return updateProduct({ id: savedProductId, data: values }).unwrap();
    return createProduct(values).unwrap();
  };
  const selectQuickProduct = (product: Product): void => {
    if (!quickProductTarget) return;
    requestKey.current = null;
    form.setFieldValue([quickProductTarget.list, quickProductTarget.index, 'productId'], product.id);
    form.setFields([
      { name: [quickProductTarget.list, quickProductTarget.index, 'productId'], errors: [] },
      { name: ['frameItems'], errors: [] },
    ]);
    setSelectedProducts((current) => ({ ...current, [product.id]: product }));
    setProductQuery('');
    setQuickProductTarget(null);
    message.success(`Đã thêm và chọn ${product.name}.`);
  };
  const openQuickProduct = (type: ProductType, list: QuickProductTarget['list'], index: number): void => setQuickProductTarget({ type, list, index });
  const createQuickEyeExam = async (values: EyeExamInput, intent: 'draft' | 'finalize', idempotencyKey: string): Promise<void> => {
    try {
      const exam = intent === 'finalize'
        ? await finalizeEyeExam({ ...values, idempotencyKey }).unwrap()
        : await createEyeExam({ ...values, idempotencyKey }).unwrap();
      setQuickEyeExamOpen(false);
      if (intent === 'finalize') {
        requestKey.current = null;
        window.setTimeout(() => form.setFieldsValue({ eyeExamId: exam.id }), 0);
        message.success('Đã chốt và chọn phiếu đo mắt cho đơn.');
      } else message.success('Đã lưu nháp phiếu đo. Hãy chốt phiếu trước khi chọn vào đơn.');
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
  const selectCustomer = (value: string): void => {
    const currentSelectedCustomerId = selectedCustomerOption?.id ?? (mode === 'edit' ? order?.customerId : initialCustomer?.id);
    const isChanged = value !== currentSelectedCustomerId;
    setSelectedCustomerOption(customerOptions.find((option) => option.value === value)?.customer);
    setCustomerQuery('');
    if (!isChanged) return;

    // Do nothing when no prescription is selected. Besides avoiding an
    // unnecessary form update, this keeps Ant Design from re-entering its
    // store while it is still committing the Select change.
    if (!form.getFieldValue('eyeExamId')) return;
    window.requestAnimationFrame(() => {
      if (form.getFieldValue('customerId') === value && form.getFieldValue('eyeExamId')) {
        form.setFieldsValue({ eyeExamId: undefined });
      }
    });
  };
  const requestClose = (): void => {
    if (!form.isFieldsTouched()) {
      onClose();
      return;
    }
    Modal.confirm({
      className: 'customer-action-confirm order-form-discard-confirm',
      icon: <ExclamationCircleFilled />,
      title: mode === 'edit' ? 'Bỏ thay đổi đơn hàng?' : 'Hủy tạo đơn hàng?',
      content: mode === 'edit'
        ? 'Những thay đổi chưa lưu sẽ bị mất. Đơn hàng hiện tại sẽ giữ nguyên.'
        : 'Thông tin đơn hàng đang nhập sẽ bị mất và không thể khôi phục.',
      okText: mode === 'edit' ? 'Bỏ thay đổi' : 'Hủy tạo đơn',
      cancelText: 'Tiếp tục nhập',
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  };

  return <Modal
    className="order-form-modal"
    open={open}
    centered
    width={1040}
    title={<div className="order-form-modal__title"><strong>{mode === 'edit' ? `Sửa đơn hàng ${order?.code ?? ''}` : isReadySale ? 'Bán và giao ngay' : 'Tạo đơn hẹn lấy'}</strong><span>{isReadySale ? isReadySaleTransfer ? 'Khách hàng → Sản phẩm → Tạo QR → Xác nhận đã nhận tiền' : 'Khách hàng → Sản phẩm → Thu đủ tiền → Hoàn tất' : 'Khách hàng → Sản phẩm → Nhận cọc → Hẹn khách lấy'}</span></div>}
    onCancel={requestClose}
    footer={<Space><Button onClick={requestClose}>Hủy</Button><Button type="primary" loading={loading} onClick={() => void form.submit()}>{mode === 'edit' ? 'Lưu thay đổi' : total > 0 ? isReadySale ? isReadySaleTransfer ? `Tạo QR thanh toán · ${formatMoney(total)}` : `Thanh toán & hoàn tất · ${formatMoney(total)}` : `Tạo đơn hẹn lấy · ${formatMoney(total)}` : isReadySale ? isReadySaleTransfer ? 'Tạo QR thanh toán' : 'Thanh toán & hoàn tất' : 'Tạo đơn hẹn lấy'}</Button></Space>}
  >
    <Form<OrderFormValues> form={form} layout="vertical" requiredMark="optional" onValuesChange={() => { requestKey.current = null; }} onFinish={submit}>
      <div className="order-form__workspace">
        <main className="order-form__main">
      {mode === 'create' ? <section className="order-form__type"><div className="order-form__heading"><strong>Loại giao dịch</strong><span>Chọn cách bán phù hợp trước khi nhập sản phẩm và thanh toán.</span></div><Form.Item name="orderType" noStyle><Radio.Group className="order-form__type-options"><Radio.Button value="PREORDER"><strong>Đơn đặt trước / hẹn lấy</strong><span>Nhận cọc và hẹn khách quay lại lấy kính.</span></Radio.Button><Radio.Button value="READY_SALE"><strong>Bán và giao ngay</strong><span>Thu đủ tiền, giao kính và hoàn tất ngay.</span></Radio.Button></Radio.Group></Form.Item></section> : null}
      <section className="order-form__customer">
        <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng.' }]}>
          <Select
            showSearch
            searchValue={customerQuery}
            filterOption={false}
            onSearch={setCustomerQuery}
            onSelect={selectCustomer}
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
      <Form.List name="frameItems" rules={[{ validator: async () => { if (!frameItems.some((item) => item?.productId) && !lensItems.some((item) => item?.productId) && !accessoryItems.some((item) => item?.productId)) throw new Error('Chọn ít nhất một gọng, tròng, kính áp tròng hoặc phụ kiện.'); } }]}>
        {(fields, { add, remove }, { errors }) => <section className="order-form__items order-form__items--frame">
          <div className="order-form__heading"><strong>Gọng kính</strong><span>Mỗi dòng là một mẫu gọng. Có thể thêm nhiều gọng hoặc tăng số lượng khi khách mua cùng mẫu; xóa dòng này nếu đơn không có gọng.</span></div>
          {fields.map((field) => <div className="order-form__item" key={field.key}>
            <Form.Item name={[field.name, 'productId']} validateTrigger="onChange" rules={[{ required: true, message: 'Chọn gọng kính.' }]}>
              <Select showSearch filterOption={false} onSearch={setProductQuery} onSelect={selectProduct} placeholder="Chọn gọng kính" options={frameProducts.map(productOption)} optionRender={renderProductOption} labelRender={renderSelectedProduct} notFoundContent={productNotFoundContent} classNames={{ popup: { root: 'order-product-select-dropdown' } }} popupRender={(menu) => <>{menu}<div className="order-product-select__footer"><Button type="link" icon={<PlusOutlined />} onClick={() => openQuickProduct('FRAME', 'frameItems', field.name)}>Tạo nhanh gọng kính</Button></div></>} />
            </Form.Item>
            <div className="order-form__quantity"><span>Số lượng</span><Form.Item name={[field.name, 'qty']} validateTrigger="onChange" rules={[{ required: true, message: 'Nhập SL.' }, { type: 'number', min: 1, message: 'SL từ 1.' }]}><InputNumber controls={false} min={1} precision={0} inputMode="numeric" parser={integerParser} {...integerOnlyInputProps} /></Form.Item></div>
            <Tooltip title="Xóa gọng"><Button className="order-form__remove-item" aria-label="Xóa gọng kính" type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Tooltip>
          </div>)}
          <Form.ErrorList errors={errors} />
          <Button block className="order-form__add-item" icon={<PlusOutlined />} onClick={() => add({ productId: '', qty: 1 })}>Thêm gọng kính khác</Button>
        </section>}
      </Form.List>
      <Form.List name="lensItems">
        {(fields, { add, remove }) => <section className="order-form__items order-form__items--lens">
          <div className="order-form__heading"><strong>Tròng kính / Kính áp tròng</strong><span>Chọn bộ/cặp tròng hoặc hộp kính áp tròng theo phiếu đo mắt đã chọn.</span></div>
          {fields.map((field) => <div className="order-form__item" key={field.key}>
            <Form.Item name={[field.name, 'productId']} validateTrigger="onChange" rules={[{ required: true, message: 'Chọn tròng hoặc kính áp tròng.' }]}>
              <Select showSearch filterOption={false} onSearch={setProductQuery} onSelect={selectProduct} placeholder="Chọn tròng hoặc kính áp tròng" options={lensProducts.map(productOption)} optionRender={renderProductOption} labelRender={renderSelectedProduct} notFoundContent={productNotFoundContent} classNames={{ popup: { root: 'order-product-select-dropdown' } }} popupRender={(menu) => <>{menu}<div className="order-product-select__footer"><Button type="link" icon={<PlusOutlined />} onClick={() => openQuickProduct('LENS', 'lensItems', field.name)}>Tạo nhanh tròng kính</Button></div></>} />
            </Form.Item>
            <div className="order-form__quantity"><span>Số lượng</span><Form.Item name={[field.name, 'qty']} validateTrigger="onChange" rules={[{ required: true, message: 'Nhập SL.' }, { type: 'number', min: 1, message: 'SL từ 1.' }]}><InputNumber controls={false} min={1} precision={0} inputMode="numeric" parser={integerParser} {...integerOnlyInputProps} /></Form.Item></div>
            <Tooltip title="Xóa sản phẩm"><Button className="order-form__remove-item" aria-label="Xóa tròng hoặc kính áp tròng" type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Tooltip>
          </div>)}
          <Button block className="order-form__add-item" icon={<PlusOutlined />} onClick={() => add({ productId: '', qty: 1 })}>Thêm tròng / kính áp tròng khác</Button>
        </section>}
      </Form.List>
      <Form.List name="accessoryItems">
        {(fields, { add, remove }) => <section className="order-form__items order-form__items--accessory">
          <div className="order-form__heading"><strong>Phụ kiện</strong><span>Thêm hộp, khăn lau hoặc sản phẩm đi kèm nếu có.</span></div>
          {fields.map((field) => <div className="order-form__item" key={field.key}>
            <Form.Item name={[field.name, 'productId']} validateTrigger="onChange" rules={[{ required: true, message: 'Chọn phụ kiện.' }]}>
              <Select showSearch filterOption={false} onSearch={setProductQuery} onSelect={selectProduct} placeholder="Chọn phụ kiện" options={accessoryProducts.map(productOption)} optionRender={renderProductOption} labelRender={renderSelectedProduct} notFoundContent={productNotFoundContent} classNames={{ popup: { root: 'order-product-select-dropdown' } }} popupRender={(menu) => <>{menu}<div className="order-product-select__footer"><Button type="link" icon={<PlusOutlined />} onClick={() => openQuickProduct('ACCESSORY', 'accessoryItems', field.name)}>Tạo nhanh phụ kiện</Button></div></>} />
            </Form.Item>
            <div className="order-form__quantity"><span>Số lượng</span><Form.Item name={[field.name, 'qty']} validateTrigger="onChange" rules={[{ required: true, message: 'Nhập SL.' }, { type: 'number', min: 1, message: 'SL từ 1.' }]}><InputNumber controls={false} min={1} precision={0} inputMode="numeric" parser={integerParser} {...integerOnlyInputProps} /></Form.Item></div>
            <Tooltip title="Xóa sản phẩm"><Button className="order-form__remove-item" aria-label="Xóa phụ kiện" type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Tooltip>
          </div>)}
          <Button block className="order-form__add-item" icon={<PlusOutlined />} onClick={() => add({ productId: '', qty: 1 })}>Thêm phụ kiện khác</Button>
        </section>}
      </Form.List>
      {needsPrescription ? <section className="order-form__prescription">
        <div className="order-form__heading"><strong>Phiếu đo mắt (Rx)</strong><span>Bắt buộc vì đơn có tròng kính hoặc kính áp tròng.</span></div>
        <Form.Item name="eyeExamId" rules={[{ required: true, message: 'Đơn có tròng kính cần chọn phiếu đo mắt.' }]}>
          <Select
            disabled={!customerId}
            loading={isFetchingEyeExams}
            placeholder={customerId ? 'Chọn phiếu đo mắt của khách' : 'Chọn khách hàng trước'}
            options={eyeExamOptions}
            optionRender={(option) => {
              const exam = option.data.exam as EyeExam;
              return <div className="order-rx-option">
                <div className="order-rx-option__heading"><strong>Phiếu đo ngày {formatExamDate(exam.examDate)}</strong>{exam.pdTotal !== null ? <span>PD {exam.pdTotal} mm</span> : null}</div>
                {exam.noPrescription
                  ? <p>Không kê đơn kính{exam.noPrescriptionReason ? ` · ${exam.noPrescriptionReason}` : ''}</p>
                  : <div className="order-rx-option__values"><span>{formatEyeSummary(exam, 'right')}</span><span>{formatEyeSummary(exam, 'left')}</span></div>}
              </div>;
            }}
            classNames={{ popup: { root: 'order-rx-select-dropdown' } }}
            notFoundContent={customerId ? 'Khách chưa có phiếu đo đã chốt.' : null}
            popupRender={(menu) => <>{menu}<div className="order-rx-select__footer"><Button type="link" icon={<PlusOutlined />} onClick={() => setQuickEyeExamOpen(true)}>Tạo nhanh phiếu đo mắt</Button></div></>}
          />
        </Form.Item>
        {selectedEyeExam ? <div className="order-form__rx-preview">
          <div className="order-form__rx-preview-heading"><strong>Đã chọn — Rx sẽ được khóa vào đơn</strong><span>Phiếu đo ngày {formatExamDate(selectedEyeExam.examDate)}</span></div>
          {selectedEyeExam.noPrescription
            ? <p className="order-form__rx-no-prescription">Phiếu này không kê đơn kính{selectedEyeExam.noPrescriptionReason ? `: ${selectedEyeExam.noPrescriptionReason}` : ''}.</p>
            : <div className="order-form__rx-values">
              <span>{formatEyeSummary(selectedEyeExam, 'right')}</span>
              <span>{formatEyeSummary(selectedEyeExam, 'left')}</span>
              {selectedEyeExam.pdTotal !== null ? <span>PD tổng: {selectedEyeExam.pdTotal} mm</span> : null}
            </div>}
        </div> : null}
      </section> : null}
        </main>
        <aside className="order-form__summary">
          <div className="order-form__summary-heading"><strong>Tóm tắt đơn</strong><span>{summaryItems.length ? `${summaryItems.length} sản phẩm đã chọn` : 'Chưa có sản phẩm'}</span></div>
          <div className="order-form__summary-items">{summaryItems.length ? summaryItems.map((item) => <div key={item.productId}><div className="order-form__summary-product"><ProductImage product={item.product} size="summary" /><span>{item.product.name} <b>× {item.qty}</b></span></div><strong>{formatMoney(item.product.salePrice * item.qty)}</strong></div>) : <p>Thêm gọng, tròng hoặc phụ kiện để xem tổng tiền.</p>}</div>
          <div className="order-form__summary-controls">
            <Form.Item label="Chiết khấu" extra={discountMode === 'PERCENT' ? `Tương đương ${formatMoney(discount)}.` : undefined}><div className="order-form__discount-control"><Form.Item name="discountValue" noStyle dependencies={['discountMode']} rules={[{ type: 'number', min: 0, max: discountLimit, message: discountMode === 'PERCENT' ? 'Chiết khấu phần trăm từ 0 đến 100.' : `Chiết khấu không vượt quá ${formatMoney(subtotal)}.` }]}><InputNumber controls={false} min={0} max={discountLimit} precision={0} inputMode="numeric" parser={integerParser} onFocus={selectNumericValue} placeholder="0" style={{ width: '100%' }} {...integerOnlyInputProps} /></Form.Item><Form.Item name="discountMode" noStyle><Select className="order-form__discount-mode" options={[{ value: 'AMOUNT', label: 'VNĐ' }, { value: 'PERCENT', label: '%' }]} /></Form.Item></div><Form.Item noStyle shouldUpdate>{() => <Form.ErrorList errors={form.getFieldError('discountValue')} />}</Form.Item></Form.Item>
            {mode === 'edit' ? <div className="order-form__paid"><span>Đã nhận</span><strong>{formatMoney(receivedAmount)}</strong></div> : <>{isReadySale ? <><Form.Item name="deposit" label="Thanh toán khi bán (đ)"><InputNumber disabled precision={0} formatter={formatVndInput} style={{ width: '100%' }} /></Form.Item><Form.Item name="depositMethod" label={<><span className="order-form__required-mark" aria-hidden="true">*</span> Hình thức thanh toán</>} validateTrigger="onChange" rules={[{ required: true, message: 'Chọn hình thức thanh toán.' }]}><Select placeholder="Chọn hình thức thanh toán" options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item><p className="order-form__ready-sale-note">{isReadySaleTransfer ? 'Tạo đơn chờ thanh toán, sau đó hiện QR để khách quét. Chỉ hoàn tất khi bạn xác nhận đã nhận tiền.' : depositMethod ? 'Đơn được thu đủ tiền và hoàn tất ngay khi tạo.' : 'Chọn hình thức thanh toán trước khi hoàn tất đơn.'}</p></> : <><Form.Item name="deposit" label="Đã nhận / tiền cọc (đ)" rules={[{ type: 'number', min: 0, message: 'Số tiền đã nhận không hợp lệ.' }]}><InputNumber min={0} precision={0} inputMode="numeric" formatter={formatVndInput} parser={integerParser} onFocus={selectNumericValue} style={{ width: '100%' }} {...integerOnlyInputProps} /></Form.Item>{deposit > 0 ? <Form.Item name="depositMethod" label={<><span className="order-form__required-mark" aria-hidden="true">*</span> Hình thức nhận tiền</>} validateTrigger="onChange" rules={[{ required: true, message: 'Chọn hình thức nhận tiền.' }]}><Select placeholder="Chọn hình thức nhận tiền" options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item> : null}<Form.Item name="dueDate" label="Ngày hẹn khách lấy kính" extra="Ngày khách dự kiến quay lại nhận kính." getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })} normalize={(value: Dayjs | null) => value?.format('YYYY-MM-DD')}><DatePicker allowClear disabledDate={disablePastDates} format="DD/MM/YYYY" placeholder="Chọn ngày khách lấy kính" style={{ width: '100%' }} /></Form.Item></>}</>}
          </div>
          <div className="order-form__total"><span>Tạm tính <b>{formatMoney(subtotal)}</b></span>{discount > 0 ? <span>Chiết khấu <b>−{formatMoney(discount)}</b></span> : null}<strong>Tổng đơn <b>{formatMoney(total)}</b></strong><em>{isReadySale ? isReadySaleTransfer ? `Sẽ tạo QR thanh toán ${formatMoney(total)}` : depositMethod ? 'Thanh toán đủ và hoàn tất đơn ngay' : 'Chọn hình thức thanh toán để tiếp tục' : `Còn phải thu ${formatMoney(remainingBalance)}`}</em></div>
        </aside>
        <Collapse className="order-form__optional" size="small" items={[{ key: 'aftercare', label: 'Tùy chọn: bảo hành & ghi chú', children: <><Form.Item name="warrantyUntil" label="Hạn bảo hành" getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })} normalize={(value: Dayjs | null) => value?.format('YYYY-MM-DD')}><DatePicker allowClear disabledDate={disablePastDates} format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" style={{ width: '100%' }} /></Form.Item><Form.Item name="note" label="Ghi chú" style={{ marginBottom: 0 }}><Input.TextArea rows={3} maxLength={500} placeholder="Ghi chú cho đơn hàng (không bắt buộc)" /></Form.Item></> }]} />
      </div>
    </Form>
    <Modal className="quick-customer-modal" open={quickCustomerOpen} centered forceRender title={<div className="quick-customer-modal__heading"><span><UserAddOutlined /></span><div><strong>Thêm khách hàng nhanh</strong><p>Chỉ cần thông tin liên hệ để tạo đơn.</p></div></div>} onCancel={() => setQuickCustomerOpen(false)} footer={<Space size={10}><Button onClick={() => setQuickCustomerOpen(false)}>Hủy</Button><Button type="primary" loading={createCustomerState.isLoading} onClick={() => void quickCustomerForm.submit()}>Tạo và chọn khách</Button></Space>}>
      <Form<QuickCustomerValues> className="quick-customer-modal__form" form={quickCustomerForm} layout="vertical" validateTrigger="onSubmit" onFinish={createQuickCustomer}>
        <Form.Item name="name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên.' }, { validator: validateCustomerName }]}><Input autoFocus autoComplete="name" maxLength={120} placeholder="Nguyễn Văn A" prefix={<UserOutlined />} /></Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại.' }, { validator: validateVietnamPhone }]}><Input autoComplete="tel" inputMode="tel" maxLength={30} placeholder="0901 234 567" type="tel" /></Form.Item>
        <p>Ngày sinh, địa chỉ và ghi chú có thể bổ sung sau trong hồ sơ khách hàng.</p>
      </Form>
    </Modal>
    {quickProductTarget ? <ProductForm
      open={Boolean(quickProductTarget)}
      product={null}
      initialType={quickProductTarget?.type}
      loading={createProductState.isLoading || updateProductState.isLoading}
      onClose={() => setQuickProductTarget(null)}
      onSubmit={createQuickProduct}
      onSaved={selectQuickProduct}
      zIndex={1200}
    /> : null}
    {quickEyeExamOpen ? <EyeExamForm
      open={quickEyeExamOpen}
      exam={null}
      customerId={customerId}
      lockCustomer
      finalizeOnly
      loading={createEyeExamState.isLoading || finalizeEyeExamState.isLoading}
      onClose={() => setQuickEyeExamOpen(false)}
      onSubmit={createQuickEyeExam}
      zIndex={1200}
    /> : null}
  </Modal>;
}
