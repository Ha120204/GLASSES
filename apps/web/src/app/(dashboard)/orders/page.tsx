'use client';

import { InboxOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FilterOutlined, MessageOutlined, MoreOutlined, PlusOutlined, PrinterOutlined, RollbackOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, DatePicker, Dropdown, Empty, Form, Input, Modal, Pagination, Popover, Select, Space, Spin, Table, Tag, message, type MenuProps, type TableColumnsType } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { OrderDetailDrawer } from '@/components/order-detail-drawer';
import { OrderForm } from '@/components/order-form';
import { OrderPrintModal } from '@/components/order-print-modal';
import { OrderZaloShareModal } from '@/components/order-zalo-share-modal';
import { PaymentQrModal } from '@/components/payment-qr-modal';
import { getErrorMessage, orderStatusColors, orderStatusLabels, paymentMethodLabels, type Order, type OrderInput, type OrderStatus, type OrderUpdateInput, type OrderWorkFilter, type PaymentMethod, useArchiveOrderMutation, useCancelOrderMutation, useCreateOrderMutation, useCreateOrderPaymentMutation, useCustomerQuery, useOrdersQuery, useOrderStatusCountsQuery, useRestoreOrderMutation, useUpdateOrderMutation } from '@/store/api';

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));
const outstandingBalance = (order: Order): number => Math.max(0, order.total - order.deposit - order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0));
const isOrderWorkFilter = (value: string | null): value is OrderWorkFilter => value === 'IN_PROGRESS' || value === 'TODAY' || value === 'OVERDUE';
const isOrderStatus = (value: string | null): value is OrderStatus => value === 'IN_PROGRESS' || value === 'AWAITING_PAYMENT' || value === 'DELIVERED' || value === 'CANCELLED';
const filterPopupContainer = (trigger: HTMLElement): HTMLElement => trigger.closest<HTMLElement>('.orders-filter-popover') ?? document.body;
type SavePickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }> };

const renderFulfillment = (order: Order) => {
  if (order.status === 'DELIVERED') {
    const deliveredAt = order.statusHistory.find((entry) => entry.toStatus === 'DELIVERED')?.createdAt;
    return <div className="order-due order-due--completed"><strong>{deliveredAt ? formatDate(deliveredAt) : '—'}</strong><span>Đã giao</span></div>;
  }
  if (order.status === 'CANCELLED') {
    return <span className="order-created">—</span>;
  }
  if (order.orderType === 'READY_SALE') {
    return <div className="order-due"><strong>Nhận ngay</strong><span>Tại quầy</span></div>;
  }
  if (!order.dueDate) return <span className="order-created">Chưa hẹn</span>;

  const overdue = dayjs(order.dueDate).isBefore(dayjs(), 'day');
  return <div className={overdue ? 'order-due order-due--overdue' : 'order-due'}><strong>{formatDate(order.dueDate)}</strong><span>{overdue ? 'Quá hẹn' : 'Hẹn nhận'}</span></div>;
};

function PaymentCell({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <span className="order-payment-cancelled">Đã hủy / hoàn tiền</span>;
  const balance = outstandingBalance(order);
  const paid = order.total - balance;
  if (balance === 0) return <div className="order-payment-cell order-payment-cell--settled"><strong>Đã thanh toán</strong><span>{formatMoney(order.total)}</span></div>;
  if (paid > 0) return <div className="order-payment-cell order-payment-cell--partial"><strong>Còn {formatMoney(balance)}</strong><span>Đã thu {formatMoney(paid)}</span></div>;
  return <div className="order-payment-cell order-payment-cell--unpaid"><strong>Chưa thanh toán</strong><span>Cần thu {formatMoney(balance)}</span></div>;
}

function CompactPayment({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <span className="order-total__payment">Đã hủy / hoàn tiền</span>;
  const balance = outstandingBalance(order);
  return <span className={`order-total__payment ${balance > 0 ? 'order-total__payment--due' : 'order-total__payment--settled'}`}>
    {balance > 0 ? `Còn phải thu ${formatMoney(balance)}` : 'Đã thanh toán'}
  </span>;
}

interface OrderActionMenuProps {
  order: Order;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onPrint: (order: Order) => void;
  onShareZalo: (order: Order) => void;
  onCancel: (order: Order) => void;
  onArchive: (order: Order) => void;
  onRestore: (order: Order) => void;
}

function OrderActionMenu({ order, onView, onEdit, onPrint, onShareZalo, onCancel, onArchive, onRestore }: OrderActionMenuProps) {
  const canEdit = !order.archivedAt && !['CANCELLED', 'DELIVERED'].includes(order.status);
  const canArchive = !order.archivedAt && ['CANCELLED', 'DELIVERED'].includes(order.status) && order.outstandingAmount === 0;
  const items: MenuProps['items'] = [
    { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
    ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa đơn' }] : []),
    { key: 'print', icon: <PrinterOutlined />, label: 'In phiếu đơn' },
    ...(order.orderType === 'PREORDER' && canEdit ? [{ key: 'zalo', icon: <MessageOutlined />, label: 'Chuẩn bị tin Zalo' }] : []),
    ...(canEdit ? [{ type: 'divider' as const }, { key: 'cancel', icon: <DeleteOutlined />, label: 'Hủy đơn', danger: true }] : []),
    ...(canArchive ? [{ type: 'divider' as const }, { key: 'archive', icon: <InboxOutlined />, label: 'Lưu trữ đơn' }] : []),
    ...(order.archivedAt ? [{ type: 'divider' as const }, { key: 'restore', icon: <RollbackOutlined />, label: 'Khôi phục đơn' }] : []),
  ];

  return <span className="order-action" onClick={(event) => event.stopPropagation()}>
    <Dropdown overlayClassName="order-actions-menu" trigger={['click']} menu={{ items, onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      window.setTimeout(() => {
        if (key === 'print') onPrint(order);
        else if (key === 'zalo') onShareZalo(order);
        else if (key === 'edit') onEdit(order);
        else if (key === 'cancel') onCancel(order);
        else if (key === 'archive') onArchive(order);
        else if (key === 'restore') onRestore(order);
        else onView(order);
      }, 0);
    } }}>
      <Button aria-label={`Thao tác với đơn ${order.code}`} type="text" icon={<MoreOutlined />} />
    </Dropdown>
  </span>;
}

interface MobileOrderCardProps extends OrderActionMenuProps {
  selected: boolean;
  onSelect: (order: Order, checked: boolean) => void;
}

function MobileOrderCard({ order, selected, onSelect, onView, onEdit, onPrint, onShareZalo, onCancel, onArchive, onRestore }: MobileOrderCardProps) {
  const balance = outstandingBalance(order);
  const cancelled = order.status === 'CANCELLED';

  return <article className={`orders-mobile-card${selected ? ' orders-mobile-card--selected' : ''}`} aria-label={`Đơn ${order.code}`}>
    <div className="orders-mobile-card__header">
      <Checkbox aria-label={`Chọn đơn ${order.code}`} checked={selected} onChange={(event) => onSelect(order, event.target.checked)} />
      <div className="orders-mobile-card__identity"><strong>{order.code}</strong><span>{order.archivedAt ? `Lưu trữ ${formatDate(order.archivedAt)}` : `Tạo ${formatDate(order.createdAt)}`}</span></div>
      <Tag className="order-status-tag" color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag>
    </div>
    <div className="orders-mobile-card__details">
      <div><span>Khách hàng</span><strong>{order.customer.name}</strong><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></div>
      <div><span>Nhận hàng</span>{renderFulfillment(order)}</div>
    </div>
    <div className="orders-mobile-card__product">
      <span>{order.items[0]?.name ?? 'Chưa có sản phẩm'}{order.items[0] ? ` × ${order.items[0].qty}` : ''}</span>
      {order.items.length > 1 ? <b>+{order.items.length - 1} mặt hàng</b> : null}
    </div>
    <div className="orders-mobile-card__money">
      <div><span>Tổng đơn</span><strong>{formatMoney(order.total)}</strong></div>
      <div className={cancelled ? '' : balance > 0 ? 'orders-mobile-card__money--due' : 'orders-mobile-card__money--settled'}>
        <span>{cancelled ? 'Thanh toán' : balance > 0 ? 'Còn phải thu' : 'Thanh toán'}</span>
        <strong>{cancelled ? 'Đã hủy / hoàn tiền' : balance > 0 ? formatMoney(balance) : 'Đã đủ'}</strong>
      </div>
    </div>
    <div className="orders-mobile-card__actions">
      <Button type="primary" onClick={() => onView(order)}>Xem chi tiết</Button>
      <OrderActionMenu order={order} onView={onView} onEdit={onEdit} onPrint={onPrint} onShareZalo={onShareZalo} onCancel={onCancel} onArchive={onArchive} onRestore={onRestore} />
    </div>
  </article>;
}

function CancelOrderModal({ order, loading, onClose, onSubmit }: { order: Order; loading: boolean; onClose: () => void; onSubmit: (values: { reason: string; refundMethod?: PaymentMethod }) => Promise<void> }) {
  const [form] = Form.useForm<{ reason: string; refundMethod?: PaymentMethod }>();
  const hasPayment = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0) > 0;
  return <Modal className="order-cancel-modal" centered width={560} open onCancel={onClose} footer={<div className="order-cancel-modal__footer"><Button onClick={onClose}>Quay lại</Button><Button danger type="primary" loading={loading} onClick={() => void form.submit()}>Xác nhận hủy đơn</Button></div>} title={<div className="order-cancel-modal__title"><span><WarningOutlined /></span><div><strong>Hủy đơn hàng</strong><small>{order.code} · {order.customer.name}</small></div></div>}><div className="order-cancel-modal__body"><div className="order-cancel-modal__notice">{hasPayment ? 'Đơn đã có khoản thanh toán. Hệ thống sẽ ghi nhận hoàn tiền theo thông tin bên dưới.' : 'Đơn chưa có khoản thanh toán. Thao tác này sẽ đưa đơn vào trạng thái đã hủy.'}</div><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="reason" label="Lý do hủy" rules={[{ validator: async (_, value: string | undefined) => { if (!value || value.trim().length < 3) throw new Error('Nhập lý do hủy ít nhất 3 ký tự.'); } }]}><Input.TextArea rows={3} maxLength={500} placeholder="Ví dụ: Khách đổi nhu cầu, không tiếp tục đặt hàng…" /></Form.Item>{hasPayment ? <Form.Item name="refundMethod" label="Hình thức hoàn tiền" rules={[{ required: true, message: 'Chọn hình thức hoàn tiền.' }]}><Select placeholder="Chọn hình thức hoàn tiền" options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item> : null}</Form></div></Modal>;
}

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const customerId = searchParams.get('customerId') ?? undefined;
  const archiveView = searchParams.get('archiveView') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  const isArchivedView = archiveView === 'ARCHIVED';
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  const rawStatus = searchParams.get('status');
  const status = isOrderStatus(rawStatus) ? rawStatus : undefined;
  const rawWorkFilter = searchParams.get('workFilter');
  const workFilter = isOrderWorkFilter(rawWorkFilter) ? rawWorkFilter : undefined;
  const outstanding = searchParams.get('paymentOutstanding') === 'true';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const dateRange: [string, string] | undefined = dateFrom && dateTo && dayjs(dateFrom).isValid() && dayjs(dateTo).isValid() ? [dateFrom, dateTo] : undefined;
  const sortDirection = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
  const requestedPage = Number(searchParams.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const formOpen = searchParams.get('create') === '1';
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const selectedOrderId = searchParams.get('orderId');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [zaloOrder, setZaloOrder] = useState<Order | null>(null);
  const [qrPaymentOrder, setQrPaymentOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [pendingArchiveAction, setPendingArchiveAction] = useState<{ kind: 'archive' | 'restore'; order: Order } | null>(null);
  const qrRequestKey = useRef<string | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const exporting = useRef(false);
  const searchResetPending = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const setOverlayParam = (key: 'create' | 'orderId', value?: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    const url = `${pathname}${params.size ? `?${params.toString()}` : ''}`;
    if (value) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };
  const openCreateForm = (): void => setOverlayParam('create', '1');
  const closeCreateForm = (): void => setOverlayParam('create');
  const openOrderDetail = (id: string): void => setOverlayParam('orderId', id);
  const closeOrderDetail = (): void => setOverlayParam('orderId');
  const { currentData: data, isFetching, isError, refetch } = useOrdersQuery({ customerId, q: q || undefined, status, workFilter: isArchivedView ? undefined : workFilter, paymentOutstanding: isArchivedView ? undefined : outstanding || undefined, dateFrom: dateRange?.[0], dateTo: dateRange?.[1], sortDirection, archiveView, page, pageSize: 10 });
  const { data: counts } = useOrderStatusCountsQuery(customerId);
  const { data: selectedCustomer } = useCustomerQuery(customerId ?? '', { skip: !customerId });
  const [createOrder, createState] = useCreateOrderMutation();
  const [createOrderPayment, createOrderPaymentState] = useCreateOrderPaymentMutation();
  const [updateOrder, updateState] = useUpdateOrderMutation();
  const [cancelOrder, cancelState] = useCancelOrderMutation();
  const [archiveOrder, archiveState] = useArchiveOrderMutation();
  const [restoreOrder, restoreState] = useRestoreOrderMutation();

  useEffect(() => {
    const syncFromHistory = (): void => {
      setQInput(new URLSearchParams(window.location.search).get('q') ?? '');
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);
  useEffect(() => () => { if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); }, []);
  useEffect(() => {
    if (searchResetPending.current) {
      if (!q) searchResetPending.current = false;
      return;
    }
    if (qInput.trim() === q) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(queryString);
      if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
      params.delete('page');
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, q, qInput, queryString, router]);

  const updateFilters = (changes: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
    Object.entries(changes).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    if (!Object.hasOwn(changes, 'page')) params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const changeArchiveView = (nextView: 'ACTIVE' | 'ARCHIVED'): void => {
    if (nextView === archiveView) return;
    const params = new URLSearchParams(searchParams.toString());
    if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
    ['status', 'workFilter', 'paymentOutstanding', 'page', 'orderId', 'create'].forEach((key) => params.delete(key));
    if (nextView === 'ARCHIVED') params.set('archiveView', 'ARCHIVED'); else params.delete('archiveView');
    setSelectedIds([]);
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const clearFilters = (): void => {
    const params = new URLSearchParams(searchParams.toString());
    ['q', 'status', 'workFilter', 'paymentOutstanding', 'dateFrom', 'dateTo', 'sortDirection', 'page'].forEach((key) => params.delete(key));
    searchResetPending.current = true;
    setQInput('');
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    setSelectedIds([]);
  }, [archiveView, customerId, q, status, workFilter, outstanding, dateRange?.[0], dateRange?.[1], sortDirection, page]);

  const submit = async (values: OrderInput): Promise<void> => { try { const order = await createOrder({ ...values, idempotencyKey: values.idempotencyKey ?? crypto.randomUUID() }).unwrap(); closeCreateForm(); if (order.status === 'AWAITING_PAYMENT') { qrRequestKey.current = null; setQrPaymentOrder(order); messageApi.info('Đơn đang chờ thanh toán. Kiểm tra QR trước khi xác nhận đã nhận tiền.'); } else if (order.orderType === 'PREORDER') setCreatedOrder(order); else messageApi.success('Đã tạo đơn hàng.'); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const confirmQrPayment = async (amount: number): Promise<void> => { if (!qrPaymentOrder) return; qrRequestKey.current ??= crypto.randomUUID(); try { await createOrderPayment({ id: qrPaymentOrder.id, idempotencyKey: qrRequestKey.current, amount, method: 'TRANSFER', note: `Thanh toán QR · ${qrPaymentOrder.code}` }).unwrap(); messageApi.success('Đã nhận chuyển khoản và hoàn tất đơn hàng.'); setQrPaymentOrder(null); qrRequestKey.current = null; } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const submitUpdate = async (values: OrderInput): Promise<void> => { if (!orderToEdit) return; const data: OrderUpdateInput = { customerId: values.customerId, eyeExamId: values.eyeExamId, items: values.items, discount: values.discount, dueDate: values.dueDate, warrantyUntil: values.warrantyUntil, note: values.note }; try { await updateOrder({ id: orderToEdit.id, data }).unwrap(); messageApi.success('Đã lưu thay đổi đơn hàng.'); setOrderToEdit(null); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const submitCancel = async (values: { reason: string; refundMethod?: PaymentMethod }): Promise<void> => { if (!orderToCancel) return; try { await cancelOrder({ id: orderToCancel.id, ...values }).unwrap(); messageApi.success('Đã hủy đơn hàng.'); setOrderToCancel(null); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const submitArchiveAction = async (): Promise<void> => {
    if (!pendingArchiveAction) return;
    const { kind, order } = pendingArchiveAction;
    try {
      if (kind === 'archive') await archiveOrder(order.id).unwrap();
      else await restoreOrder(order.id).unwrap();
      messageApi.success(kind === 'archive' ? 'Đã lưu trữ đơn hàng.' : 'Đã khôi phục đơn hàng.');
      setPendingArchiveAction(null);
      setSelectedIds([]);
      if (data?.items.length === 1 && page > 1) updateFilters({ page: String(page - 1) });
    } catch (error: unknown) { messageApi.error(getErrorMessage(error)); }
  };
  const chooseStatus = (nextStatus: string): void => updateFilters({ status: nextStatus === 'ALL' ? undefined : nextStatus, workFilter: undefined });
  const chooseWorkFilter = (nextFilter: OrderWorkFilter): void => updateFilters({ workFilter: workFilter === nextFilter ? undefined : nextFilter, status: undefined });
  const exportOrders = async (ids?: string[]): Promise<void> => {
    if (exporting.current) return;
    exporting.current = true;
    setIsExporting(true);
    const params = new URLSearchParams();
    if (ids?.length) {
      params.set('ids', ids.join(','));
    } else {
      if (customerId) params.set('customerId', customerId);
      if (isArchivedView) params.set('archiveView', 'ARCHIVED');
      if (qInput.trim()) params.set('q', qInput.trim());
      if (status) params.set('status', status);
      if (workFilter && !isArchivedView) params.set('workFilter', workFilter);
      if (outstanding && !isArchivedView) params.set('paymentOutstanding', 'true');
      if (dateRange?.[0]) params.set('dateFrom', dateRange[0]);
      if (dateRange?.[1]) params.set('dateTo', dateRange[1]);
      params.set('sortDirection', sortDirection);
    }
    try {
      const picker = (window as SavePickerWindow).showSaveFilePicker;
      const file = picker ? await picker.call(window, { suggestedName: 'danh-sach-don-hang.xlsx' }) : null;
      const response = await fetch(`/api/orders/export${params.size ? `?${params.toString()}` : ''}`, { credentials: 'include' });
      if (!response.ok) {
        const error: unknown = await response.json();
        messageApi.error(getErrorMessage({ data: error }));
        return;
      }
      if (file && response.body) {
        await response.body.pipeTo(await file.createWritable());
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = url;
      const link = document.createElement('a');
      link.href = url;
      link.download = 'danh-sach-don-hang.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) { if (!(error instanceof DOMException && error.name === 'AbortError')) messageApi.error('Không thể xuất Excel. Vui lòng kiểm tra kết nối và thử lại.'); }
    finally { exporting.current = false; setIsExporting(false); }
  };
  const columns: TableColumnsType<Order> = [
    { key: 'code', title: 'Mã đơn', dataIndex: 'code', width: 190, render: (value: string, order: Order) => <div><strong className="order-code">{value}</strong><span className="order-created">{order.archivedAt ? `Lưu trữ ${formatDate(order.archivedAt)}` : `Tạo ${formatDate(order.createdAt)}`}</span></div> },
    { key: 'customer', title: 'Khách hàng', width: 185, render: (_: unknown, order: Order) => <div className="order-customer"><strong>{order.customer.name}</strong><span>{order.customer.phone}</span></div> },
    { key: 'items', title: 'Sản phẩm', responsive: ['md'], render: (_: unknown, order: Order) => <div className="order-items"><strong>{order.items[0]?.name}{order.items[0] ? ` × ${order.items[0].qty}` : ''}</strong>{order.items.length > 1 ? <span>+{order.items.length - 1} mặt hàng khác</span> : null}</div> },
    { key: 'fulfillment', title: 'Hẹn nhận / Đã giao', responsive: ['lg'], width: 162, render: (_: unknown, order: Order) => renderFulfillment(order) },
    { key: 'total', title: 'Tổng đơn', dataIndex: 'total', align: 'right', render: (_: number, order: Order) => <div className="order-total"><strong>{formatMoney(order.total)}</strong><CompactPayment order={order} /></div> },
    { key: 'payment', title: 'Thanh toán', align: 'right', responsive: ['lg'], width: 164, render: (_: unknown, order: Order) => <PaymentCell order={order} /> },
    { key: 'status', title: 'Tình trạng', dataIndex: 'status', width: 158, render: (value: OrderStatus) => <Tag className="order-status-tag" color={orderStatusColors[value]}>{orderStatusLabels[value]}</Tag> },
    { key: 'actions', title: '', width: 56, align: 'center', render: (_: unknown, order: Order) => <OrderActionMenu order={order} onView={(selected) => openOrderDetail(selected.id)} onEdit={setOrderToEdit} onPrint={(selected) => setPrintOrderId(selected.id)} onShareZalo={setZaloOrder} onCancel={setOrderToCancel} onArchive={(selected) => setPendingArchiveAction({ kind: 'archive', order: selected })} onRestore={(selected) => setPendingArchiveAction({ kind: 'restore', order: selected })} /> },
  ];

  const workFilters: Array<{ value: OrderWorkFilter; label: string; count: number; tone: string }> = [
    { value: 'IN_PROGRESS', label: 'Đang thực hiện', count: counts?.work.inProgress ?? 0, tone: 'action' },
    { value: 'TODAY', label: 'Hẹn hôm nay', count: counts?.work.today ?? 0, tone: 'today' },
    { value: 'OVERDUE', label: 'Quá hẹn', count: counts?.work.overdue ?? 0, tone: 'overdue' },
  ];

  const activeFilterLabels = [
    q ? `Tìm: ${q}` : null,
    workFilter && !isArchivedView ? workFilters.find((filter) => filter.value === workFilter)?.label : null,
    status ? orderStatusLabels[status] : null,
    outstanding && !isArchivedView ? 'Còn phải thu' : null,
    dateRange ? `${dayjs(dateRange[0]).format('DD/MM/YYYY')} – ${dayjs(dateRange[1]).format('DD/MM/YYYY')}` : null,
    sortDirection === 'asc' ? 'Cũ nhất' : null,
  ].filter((label): label is string => Boolean(label));
  const extraFilterCount = Number(Boolean(status)) + Number(outstanding && !isArchivedView) + Number(Boolean(dateRange));

  const emptyText = isError
    ? <Empty description="Không tải được đơn hàng."><Button onClick={() => void refetch()}>Thử lại</Button></Empty>
    : activeFilterLabels.length
      ? <Empty description="Không có đơn phù hợp."><Button onClick={clearFilters}>Xóa bộ lọc</Button></Empty>
      : <Empty description={isArchivedView ? 'Chưa có đơn hàng lưu trữ.' : 'Chưa có đơn hàng nào.'} />;

  return <div className="product-page orders-page">
    {contextHolder}
    <header className="product-page__hero"><div><span className="product-page__eyebrow">BÁN HÀNG</span><h1>Đơn hàng</h1><p>{selectedCustomer ? `Toàn bộ đơn hàng của ${selectedCustomer.name}.` : 'Theo dõi đơn hẹn lấy, ngày khách quay lại và số tiền còn phải thu.'}</p></div><Space className="orders-page__header-actions" size={8}><Button className="product-excel-button" icon={<DownloadOutlined />} loading={isExporting} onClick={() => void exportOrders()}>Xuất Excel</Button><Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={openCreateForm}>Tạo đơn hàng</Button></Space></header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <nav className="orders-view-tabs" aria-label="Khu vực đơn hàng">
        <button type="button" className={isArchivedView ? '' : 'orders-view-tabs__active'} aria-current={isArchivedView ? undefined : 'page'} onClick={() => changeArchiveView('ACTIVE')}>Danh sách đơn</button>
        <button type="button" className={isArchivedView ? 'orders-view-tabs__active' : ''} aria-current={isArchivedView ? 'page' : undefined} onClick={() => changeArchiveView('ARCHIVED')}><InboxOutlined /> Đã lưu trữ</button>
      </nav>
      <div className="product-toolbar orders-toolbar">
        <div className="orders-toolbar__top">
          <Input className="product-search" prefix={<SearchOutlined />} allowClear value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="Tìm mã đơn, khách, SĐT hoặc sản phẩm" />
          <div className="orders-toolbar__actions">
            <Select className="order-sort-select" aria-label="Sắp xếp đơn hàng" value={sortDirection} options={[{ value: 'desc', label: 'Mới nhất' }, { value: 'asc', label: 'Cũ nhất' }]} onChange={(value: 'asc' | 'desc') => updateFilters({ sortDirection: value === 'desc' ? undefined : value })} />
            <Popover trigger="click" placement="bottomRight" classNames={{ root: 'orders-filter-popover' }} content={<div className="orders-filter-panel">
              <div className="orders-filter-panel__heading"><strong>Bộ lọc đơn hàng</strong><span>Chọn thêm điều kiện để thu hẹp danh sách.</span></div>
              <span className="orders-filter-panel__label">Tình trạng</span>
              <Select className="order-status-select" aria-label="Lọc theo tình trạng đơn" getPopupContainer={filterPopupContainer} value={status ?? 'ALL'} options={isArchivedView ? [{ value: 'ALL', label: 'Tất cả tình trạng' }, { value: 'DELIVERED', label: 'Đã giao · hoàn tất' }, { value: 'CANCELLED', label: 'Đã hủy' }] : [{ value: 'ALL', label: 'Tất cả tình trạng' }, { value: 'AWAITING_PAYMENT', label: 'Chờ thanh toán QR' }, { value: 'DELIVERED', label: 'Đã giao · hoàn tất' }, { value: 'CANCELLED', label: 'Đã hủy' }]} onChange={chooseStatus} />
              <span className="orders-filter-panel__label">Ngày tạo đơn</span>
              <DatePicker.RangePicker className="order-date-range" locale={viVN.DatePicker} getPopupContainer={filterPopupContainer} placeholder={['Từ ngày', 'Đến ngày']} value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null} format="DD/MM/YYYY" onChange={(values) => { const [from, to] = values ?? []; updateFilters({ dateFrom: from?.format('YYYY-MM-DD'), dateTo: to?.format('YYYY-MM-DD') }); }} />
              {!isArchivedView ? <Checkbox className="orders-filter-panel__payment" checked={outstanding} onChange={(event) => updateFilters({ paymentOutstanding: event.target.checked ? 'true' : undefined })}>Chỉ đơn còn phải thu</Checkbox> : null}
              {activeFilterLabels.length ? <Button className="orders-filter-panel__clear" type="link" onClick={clearFilters}>Xóa tất cả bộ lọc</Button> : null}
            </div>}>
              <Button className={`orders-toolbar__filter-button${extraFilterCount ? ' orders-toolbar__filter-button--active' : ''}`} icon={<FilterOutlined />} aria-label={extraFilterCount ? `Bộ lọc, đang áp dụng ${extraFilterCount} điều kiện` : 'Bộ lọc'}>Bộ lọc{extraFilterCount ? <b>{extraFilterCount}</b> : null}</Button>
            </Popover>
          </div>
        </div>
        <div className="orders-toolbar__quick">
          {isArchivedView ? <span>Đơn đã hoàn tất hoặc đã hủy được lưu tại đây.</span> : <><span>Lọc nhanh</span>
            <div className="order-quick-filters" role="group" aria-label="Lọc nhanh đơn hàng">
              {workFilters.map((filter) => <Button key={filter.value} className={`order-work-filter order-work-filter--${filter.tone}`} type={workFilter === filter.value ? 'primary' : 'default'} aria-pressed={workFilter === filter.value} onClick={() => chooseWorkFilter(filter.value)}>{filter.label}{filter.count > 0 ? <b>{filter.count}</b> : null}</Button>)}
            </div></>}
          <span className="product-toolbar__summary">{isError && !data ? 'Không tải được danh sách' : isFetching && !data ? 'Đang tải đơn hàng…' : <>Có <b>{data?.total ?? 0}</b> đơn hàng</>}</span>
        </div>
      </div>
      {activeFilterLabels.length ? <div className="orders-active-filters"><span>Đang lọc:</span>{activeFilterLabels.map((label) => <Tag key={label}>{label}</Tag>)}<Button type="link" onClick={clearFilters}>Xóa bộ lọc</Button></div> : null}
      {isError && data?.items.length ? <Alert className="orders-error-alert" type="error" showIcon message="Không cập nhật được danh sách đơn hàng." action={<Button size="small" onClick={() => void refetch()}>Thử lại</Button>} /> : null}
      {selectedIds.length ? <div className="order-export-actions" role="status"><strong>Đã chọn {selectedIds.length} đơn</strong><Button icon={<DownloadOutlined />} loading={isExporting} onClick={() => void exportOrders(selectedIds)}>Xuất {selectedIds.length} đơn đã chọn</Button><Button type="text" onClick={() => setSelectedIds([])}>Bỏ chọn</Button></div> : null}
      <Table<Order>
        className="product-table orders-table"
        rowKey="id"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(String)), columnWidth: 48 }}
        columns={columns}
        dataSource={data?.items}
        loading={isFetching}
        onRow={(order) => ({
          tabIndex: 0,
          'aria-label': `Xem chi tiết đơn ${order.code} của ${order.customer.name}`,
          onClick: (event) => { if ((event.target as HTMLElement).closest('.ant-table-selection-column')) return; openOrderDetail(order.id); },
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            openOrderDetail(order.id);
          },
        })}
        scroll={{ x: 980 }}
        locale={{ emptyText }}
        pagination={{ current: data?.page ?? page, pageSize: 10, total: data?.total ?? 0, hideOnSinglePage: false, showSizeChanger: false, showTotal: (total, range) => total ? `${range[0]}–${range[1]} / ${total} đơn` : '0 đơn', onChange: (nextPage) => updateFilters({ page: String(nextPage) }) }}
      />
      <div className="orders-mobile" aria-label="Danh sách đơn hàng" aria-busy={isFetching}>
        {isFetching && !data ? <div className="orders-mobile__loading"><Spin /><span>Đang tải đơn hàng…</span></div> : data?.items.length ? (
          <Spin spinning={isFetching}>
            <div className="orders-mobile__list">
              {data.items.map((order) => <MobileOrderCard
                key={order.id}
                order={order}
                selected={selectedIds.includes(order.id)}
                onSelect={(selected, checked) => setSelectedIds((current) => checked ? [...current, selected.id] : current.filter((id) => id !== selected.id))}
                onView={(selected) => openOrderDetail(selected.id)}
                onEdit={setOrderToEdit}
                onPrint={(selected) => setPrintOrderId(selected.id)}
                onShareZalo={setZaloOrder}
                onCancel={setOrderToCancel}
                onArchive={(selected) => setPendingArchiveAction({ kind: 'archive', order: selected })}
                onRestore={(selected) => setPendingArchiveAction({ kind: 'restore', order: selected })}
              />)}
            </div>
          </Spin>
        ) : <div className="orders-mobile__empty">{emptyText}</div>}
        <Pagination
          className="orders-mobile__pagination"
          current={data?.page ?? page}
          pageSize={10}
          total={data?.total ?? 0}
          hideOnSinglePage={false}
          simple
          showSizeChanger={false}
          onChange={(nextPage) => updateFilters({ page: String(nextPage) })}
        />
      </div>
    </Card>
    {formOpen ? <OrderForm open loading={createState.isLoading} onClose={closeCreateForm} onSubmit={submit} initialCustomer={selectedCustomer ?? null} /> : null}
    <Modal
      className="order-created-modal"
      centered
      open={Boolean(createdOrder)}
      title="Đã tạo đơn đặt trước"
      onCancel={() => setCreatedOrder(null)}
      footer={<div className="order-created-modal__actions">
        <Button onClick={() => setCreatedOrder(null)}>Đóng</Button>
        <Button icon={<PrinterOutlined />} onClick={() => { if (createdOrder) setPrintOrderId(createdOrder.id); setCreatedOrder(null); }}>In phiếu đơn</Button>
        <Button type="primary" icon={<MessageOutlined />} onClick={() => { setZaloOrder(createdOrder); setCreatedOrder(null); }}>Chuẩn bị tin Zalo</Button>
      </div>}
    >
      {createdOrder ? <p>Đơn <strong>{createdOrder.code}</strong> của {createdOrder.customer.name} đã được lưu. Bạn có thể in phiếu hoặc chuẩn bị tin hẹn nhận gửi qua Zalo.</p> : null}
    </Modal>
    <PaymentQrModal open={Boolean(qrPaymentOrder)} order={qrPaymentOrder} balance={qrPaymentOrder?.total ?? 0} onClose={() => { setQrPaymentOrder(null); qrRequestKey.current = null; }} onConfirm={confirmQrPayment} confirming={createOrderPaymentState.isLoading} requireFullPayment confirmLabel="Đã nhận tiền & hoàn tất" />
    {orderToEdit ? <OrderForm open loading={updateState.isLoading} onClose={() => setOrderToEdit(null)} onSubmit={submitUpdate} mode="edit" order={orderToEdit} /> : null}
    <OrderDetailDrawer
      orderId={selectedOrderId}
      onClose={closeOrderDetail}
      onEdit={(order) => { closeOrderDetail(); setOrderToEdit(order); }}
      onCancelOrder={(order) => { closeOrderDetail(); setOrderToCancel(order); }}
      onShareZalo={(order) => { closeOrderDetail(); setZaloOrder(order); }}
    />
    <OrderPrintModal orderId={printOrderId} onClose={() => setPrintOrderId(null)} />
    {zaloOrder ? <OrderZaloShareModal order={zaloOrder} onClose={() => setZaloOrder(null)} /> : null}
    {orderToCancel ? <CancelOrderModal order={orderToCancel} loading={cancelState.isLoading} onClose={() => setOrderToCancel(null)} onSubmit={submitCancel} /> : null}
    <Modal
      centered
      open={Boolean(pendingArchiveAction)}
      title={pendingArchiveAction?.kind === 'archive' ? 'Lưu trữ đơn hàng' : 'Khôi phục đơn hàng'}
      onCancel={() => setPendingArchiveAction(null)}
      onOk={() => void submitArchiveAction()}
      okText={pendingArchiveAction?.kind === 'archive' ? 'Lưu trữ' : 'Khôi phục'}
      okButtonProps={{ loading: archiveState.isLoading || restoreState.isLoading }}
      cancelText="Quay lại"
      cancelButtonProps={{ disabled: archiveState.isLoading || restoreState.isLoading }}
      closable={!archiveState.isLoading && !restoreState.isLoading}
      maskClosable={!archiveState.isLoading && !restoreState.isLoading}
    >
      {pendingArchiveAction ? <p>Đơn <strong>{pendingArchiveAction.order.code}</strong> của {pendingArchiveAction.order.customer.name} {pendingArchiveAction.kind === 'archive' ? 'sẽ chuyển sang mục Đã lưu trữ. Dữ liệu đơn, thanh toán và lịch sử vẫn được giữ để tra cứu.' : 'sẽ trở lại danh sách đơn hàng.'}</p> : null}
    </Modal>
  </div>;
}
