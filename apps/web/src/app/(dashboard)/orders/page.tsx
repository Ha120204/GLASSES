'use client';

import { DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined, PlusOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Dropdown, Form, Input, Modal, Select, Table, Tag, message, type MenuProps, type TableColumnsType } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrderDetailDrawer } from '@/components/order-detail-drawer';
import { OrderForm } from '@/components/order-form';
import { getErrorMessage, orderStatusColors, orderStatusLabels, paymentMethodLabels, type Order, type OrderInput, type OrderStatus, type OrderUpdateInput, type OrderWorkFilter, type PaymentMethod, useBulkUpdateOrderStatusMutation, useCancelOrderMutation, useCreateOrderMutation, useCustomerQuery, useMeQuery, useOrdersQuery, useOrderStatusCountsQuery, useUpdateOrderMutation } from '@/store/api';

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));
const outstandingBalance = (order: Order): number => Math.max(0, order.total - order.deposit - order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0));
const bulkStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['LENS_ORDERED', 'PROCESSING', 'READY'], LENS_ORDERED: ['PROCESSING', 'READY'], PROCESSING: ['READY'], READY: ['PROCESSING', 'DELIVERED'], DELIVERED: [], CANCELLED: [],
};
const isOrderWorkFilter = (value: string | null): value is OrderWorkFilter => value === 'ACTION_NEEDED' || value === 'TODAY' || value === 'OVERDUE';

function PaymentCell({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') return <span className="order-payment-cancelled">Đã hủy / hoàn tiền</span>;
  const balance = outstandingBalance(order);
  const paid = order.total - balance;
  if (balance === 0) return <div className="order-payment-cell order-payment-cell--settled"><strong>Đã thanh toán</strong><span>{formatMoney(order.total)}</span></div>;
  if (paid > 0) return <div className="order-payment-cell order-payment-cell--partial"><strong>Còn {formatMoney(balance)}</strong><span>Đã thu {formatMoney(paid)}</span></div>;
  return <div className="order-payment-cell order-payment-cell--unpaid"><strong>Chưa thanh toán</strong><span>Cần thu {formatMoney(balance)}</span></div>;
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;
  const requestedWorkFilter = searchParams.get('workFilter');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus>();
  const [workFilter, setWorkFilter] = useState<OrderWorkFilter | undefined>(() => isOrderWorkFilter(requestedWorkFilter) ? requestedWorkFilter : undefined);
  const [outstanding, setOutstanding] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string]>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>();
  const [formOpen, setFormOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelForm] = Form.useForm<{ reason: string; refundMethod?: PaymentMethod }>();
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useOrdersQuery({ customerId, q: q || undefined, status, workFilter, paymentOutstanding: outstanding || undefined, dateFrom: dateRange?.[0], dateTo: dateRange?.[1], sortDirection, page, pageSize: 10 });
  const { data: counts } = useOrderStatusCountsQuery();
  const { data: selectedCustomer } = useCustomerQuery(customerId ?? '', { skip: !customerId });
  const { data: currentUser } = useMeQuery();
  const [createOrder, createState] = useCreateOrderMutation();
  const [updateOrder, updateState] = useUpdateOrderMutation();
  const [cancelOrder, cancelState] = useCancelOrderMutation();
  const [bulkUpdateStatus, bulkUpdateState] = useBulkUpdateOrderStatusMutation();

  useEffect(() => { setSelectedIds([]); setBulkStatus(undefined); }, [status, workFilter, outstanding, dateRange?.[0], dateRange?.[1], sortDirection, page]);
  useEffect(() => {
    if (!isOrderWorkFilter(requestedWorkFilter)) return;
    setWorkFilter(requestedWorkFilter);
    setStatus(undefined);
    setPage(1);
  }, [requestedWorkFilter]);

  const submit = async (values: OrderInput): Promise<void> => { try { await createOrder(values).unwrap(); messageApi.success('Đã tạo đơn hàng.'); setFormOpen(false); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const submitUpdate = async (values: OrderInput): Promise<void> => { if (!orderToEdit) return; try { await updateOrder({ id: orderToEdit.id, data: values as OrderUpdateInput }).unwrap(); messageApi.success('Đã lưu thay đổi đơn hàng.'); setOrderToEdit(null); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const submitCancel = async (values: { reason: string; refundMethod?: PaymentMethod }): Promise<void> => { if (!orderToCancel) return; try { await cancelOrder({ id: orderToCancel.id, ...values }).unwrap(); messageApi.success('Đã hủy đơn hàng.'); setOrderToCancel(null); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const chooseStatus = (nextStatus: string): void => { setStatus(nextStatus === 'ALL' ? undefined : nextStatus as OrderStatus); setWorkFilter(undefined); setPage(1); };
  const chooseWorkFilter = (nextFilter: OrderWorkFilter): void => { setWorkFilter((current) => current === nextFilter ? undefined : nextFilter); setStatus(undefined); setPage(1); };
  const submitBulkStatus = async (): Promise<void> => {
    if (!bulkStatus || !selectedIds.length) return;
    try { const result = await bulkUpdateStatus({ ids: selectedIds, status: bulkStatus }).unwrap(); messageApi.success(`Đã cập nhật ${result.count} đơn hàng.`); setSelectedIds([]); setBulkStatus(undefined); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); }
  };

  const columns = useMemo<TableColumnsType<Order>>(() => {
    const allColumns: TableColumnsType<Order> = [
    { key: 'code', title: 'Mã đơn', dataIndex: 'code', width: 190, render: (value: string, order: Order) => <div><strong className="order-code">{value}</strong><span className="order-created">Tạo {formatDate(order.createdAt)}</span></div> },
    { key: 'customer', title: 'Khách hàng', width: 185, render: (_: unknown, order: Order) => <div className="order-customer"><strong>{order.customer.name}</strong><span>{order.customer.phone}</span></div> },
    { key: 'items', title: 'Sản phẩm', responsive: ['md'], render: (_: unknown, order: Order) => <div className="order-items"><strong>{order.items[0]?.name}{order.items[0] ? ` × ${order.items[0].qty}` : ''}</strong>{order.items.length > 1 ? <span>+{order.items.length - 1} mặt hàng khác</span> : null}</div> },
    { key: 'dueDate', title: 'Hẹn giao', responsive: ['lg'], width: 112, render: (_: unknown, order: Order) => order.dueDate ? <div className={dayjs(order.dueDate).isBefore(dayjs(), 'day') && !['CANCELLED', 'DELIVERED'].includes(order.status) ? 'order-due order-due--overdue' : 'order-due'}><strong>{formatDate(order.dueDate)}</strong><span>{dayjs(order.dueDate).isBefore(dayjs(), 'day') && !['CANCELLED', 'DELIVERED'].includes(order.status) ? 'Quá hẹn' : 'Đã hẹn'}</span></div> : <span className="order-created">Chưa hẹn</span> },
    { key: 'total', title: 'Tổng đơn', dataIndex: 'total', align: 'right', render: formatMoney },
    { key: 'payment', title: 'Thanh toán', align: 'right', responsive: ['lg'], width: 164, render: (_: unknown, order: Order) => <PaymentCell order={order} /> },
    { key: 'status', title: 'Tiến độ', dataIndex: 'status', width: 146, render: (value: OrderStatus) => <Tag className="order-status-tag" color={orderStatusColors[value]}>{orderStatusLabels[value]}</Tag> },
    { key: 'actions', title: '', width: 56, align: 'center', render: (_: unknown, order: Order) => {
      const canEdit = !['CANCELLED', 'DELIVERED'].includes(order.status);
      const items: MenuProps['items'] = [{ key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' }, ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa đơn' }] : []), { key: 'print', icon: <PrinterOutlined />, label: 'In phiếu đơn' }, ...(currentUser?.role === 'ADMIN' && canEdit ? [{ type: 'divider' as const }, { key: 'cancel', icon: <DeleteOutlined />, label: 'Hủy đơn', danger: true }] : [])];
      return <span className="order-action" onClick={(event) => event.stopPropagation()}><Dropdown menu={{ items, onClick: ({ key }) => { if (key === 'print') setPrintOrderId(order.id); else if (key === 'edit') setOrderToEdit(order); else if (key === 'cancel') { cancelForm.resetFields(); setOrderToCancel(order); } else setSelectedOrderId(order.id); } }}><Button aria-label={`Thao tác với đơn ${order.code}`} type="text" icon={<MoreOutlined />} /></Dropdown></span>;
    } },
    ];
    return allColumns;
  }, [cancelForm, currentUser?.role]);

  const workFilters: Array<{ value: OrderWorkFilter; label: string; count: number; tone: string }> = [
    { value: 'ACTION_NEEDED', label: 'Cần xử lý', count: counts?.work.actionNeeded ?? 0, tone: 'action' },
    { value: 'TODAY', label: 'Giao hôm nay', count: counts?.work.today ?? 0, tone: 'today' },
    { value: 'OVERDUE', label: 'Quá hẹn', count: counts?.work.overdue ?? 0, tone: 'overdue' },
  ];
  const selectedOrders = data?.items.filter((order) => selectedIds.includes(order.id)) ?? [];
  const bulkStatusOptions = Object.entries(orderStatusLabels).filter(([value]) => value !== 'CANCELLED' && selectedOrders.length > 0 && selectedOrders.every((order) => bulkStatusTransitions[order.status].includes(value as OrderStatus))).map(([value, label]) => ({ value, label }));

  return <div className="product-page orders-page">
    {contextHolder}
    <header className="product-page__hero"><div><span className="product-page__eyebrow">BÁN HÀNG</span><h1>Đơn hàng</h1><p>{selectedCustomer ? `Toàn bộ đơn hàng của ${selectedCustomer.name}.` : 'Theo dõi tiến độ gia công, lịch hẹn giao và công nợ của từng đơn.'}</p></div><Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>Tạo đơn hàng</Button></header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <div className="product-toolbar orders-toolbar"><div className="product-toolbar__filters"><Input className="product-search" prefix={<SearchOutlined />} allowClear value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Tìm mã đơn, khách, SĐT hoặc sản phẩm" /><div className="order-quick-filters" aria-label="Lọc nhanh theo công việc">{workFilters.map((filter) => <Button key={filter.value} className={`order-work-filter order-work-filter--${filter.tone}`} type={workFilter === filter.value ? 'primary' : 'default'} onClick={() => chooseWorkFilter(filter.value)}>{filter.label}{filter.count > 0 ? <b>{filter.count}</b> : null}</Button>)}</div><Select className="order-status-select" value={status ?? 'ALL'} options={[{ value: 'ALL', label: 'Trạng thái: Tất cả (trừ hủy)' }, ...Object.entries(orderStatusLabels).map(([value, label]) => ({ value, label }))]} onChange={chooseStatus} /><Button type={outstanding ? 'primary' : 'default'} onClick={() => { setOutstanding((current) => !current); setPage(1); }}>Còn phải thu</Button><DatePicker.RangePicker className="order-date-range" locale={viVN.DatePicker} value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null} format="DD/MM/YYYY" onChange={(values) => { const [from, to] = values ?? []; setDateRange(from && to ? [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')] : undefined); setPage(1); }} /><Select className="order-sort-select" value={sortDirection} options={[{ value: 'desc', label: 'Mới nhất' }, { value: 'asc', label: 'Cũ nhất' }]} onChange={(value: 'asc' | 'desc') => { setSortDirection(value); setPage(1); }} /></div><span className="product-toolbar__summary">Có <b>{data?.total ?? 0}</b> đơn hàng</span></div>
      {selectedIds.length ? <div className="order-bulk-actions" role="status"><strong>Đã chọn {selectedIds.length} đơn</strong><Select placeholder="Chuyển tiến độ sang" value={bulkStatus} onChange={setBulkStatus} options={bulkStatusOptions} /><Button type="primary" disabled={!bulkStatus} loading={bulkUpdateState.isLoading} onClick={() => void submitBulkStatus()}>Cập nhật tiến độ</Button><Button type="text" onClick={() => { setSelectedIds([]); setBulkStatus(undefined); }}>Bỏ chọn</Button></div> : null}
      <Table<Order> rowKey="id" columns={columns} dataSource={data?.items} loading={isFetching} rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => { setSelectedIds(keys.map(String)); setBulkStatus(undefined); }, getCheckboxProps: (order) => ({ disabled: order.status === 'CANCELLED' || order.status === 'DELIVERED' }) }} onRow={(order) => ({ onClick: (event) => { if ((event.target as HTMLElement).closest('.ant-checkbox-wrapper')) return; setSelectedOrderId(order.id); } })} scroll={{ x: 980 }} locale={{ emptyText: isError ? 'Không thể tải đơn hàng. Vui lòng thử lại.' : 'Chưa có đơn hàng nào.' }} pagination={{ current: data?.page ?? page, pageSize: 10, total: data?.total, hideOnSinglePage: true, showSizeChanger: false, onChange: setPage }} />
    </Card>
    <OrderForm open={formOpen} loading={createState.isLoading} onClose={() => setFormOpen(false)} onSubmit={submit} initialCustomer={selectedCustomer ?? null} />
    <OrderForm open={Boolean(orderToEdit)} loading={updateState.isLoading} onClose={() => setOrderToEdit(null)} onSubmit={submitUpdate} mode="edit" order={orderToEdit} />
    <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    {printOrderId ? <Modal open footer={null} onCancel={() => setPrintOrderId(null)}><Button type="primary" onClick={() => router.push(`/orders/${printOrderId}/print`)}>Mở phiếu in</Button></Modal> : null}
    {orderToCancel ? <Modal open title="Hủy đơn hàng" okText="Xác nhận hủy" okButtonProps={{ danger: true, loading: cancelState.isLoading }} onOk={() => void cancelForm.submit()} onCancel={() => setOrderToCancel(null)}><Form form={cancelForm} layout="vertical" onFinish={submitCancel}><p>{orderToCancel.deposit + orderToCancel.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0) > 0 ? 'Hệ thống sẽ ghi nhận hoàn tiền cho khách.' : 'Đơn chưa có khoản thanh toán.'}</p><Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, min: 3 }]}><Input.TextArea rows={3} maxLength={500} /></Form.Item>{orderToCancel.deposit + orderToCancel.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0) > 0 ? <Form.Item name="refundMethod" label="Hình thức hoàn tiền" rules={[{ required: true }]}><Select options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item> : null}</Form></Modal> : null}
  </div>;
}
