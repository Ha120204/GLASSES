'use client';

import { ExclamationCircleOutlined, PhoneOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Avatar, Button, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Spin, Tag, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { getErrorMessage, orderStatusColors, orderStatusLabels, orderTypeLabels, paymentMethodLabels, type Order, type OrderStatus, type PaymentMethod, useCreateOrderPaymentMutation, useOrderQuery, useUpdateOrderStatusMutation } from '@/store/api';
import { formatVndInput, integerOnlyInputProps, parseVndInput } from '@/lib/money-input';

interface OrderDetailDrawerProps { orderId: string | null; onClose: () => void; }
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const formatDateTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const paymentSummary = (order: Order) => {
  const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0);
  if (order.status === 'CANCELLED') return { paid, balance: 0, label: order.payments.some((payment) => payment.type === 'REFUND') ? 'Đã hoàn tiền' : 'Đã hủy' };
  const balance = Math.max(0, order.total - paid);
  return { paid, balance, label: paid === 0 ? 'Chưa thanh toán' : balance === 0 ? 'Đã thanh toán' : 'Đã cọc' };
};
const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['LENS_ORDERED', 'PROCESSING', 'READY'],
  LENS_ORDERED: ['PROCESSING', 'READY'],
  PROCESSING: ['READY'],
  READY: ['PROCESSING', 'DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function OrderDetailDrawer({ orderId, onClose }: OrderDetailDrawerProps) {
  const { data: order, isLoading, isError } = useOrderQuery(orderId ?? '', { skip: !orderId });
  const [createPayment, createPaymentState] = useCreateOrderPaymentMutation();
  const [updateStatus, updateStatusState] = useUpdateOrderStatusMutation();
  const [form] = Form.useForm<{ amount: number; method: PaymentMethod; note?: string }>();
  const [nextStatus, setNextStatus] = useState<OrderStatus>();
  const paymentFormRef = useRef<HTMLDivElement>(null);
  const summary = order ? paymentSummary(order) : null;
  useEffect(() => { if (order && order.status !== 'CANCELLED' && summary && summary.balance > 0) form.setFieldsValue({ method: 'CASH', amount: undefined, note: undefined }); }, [form, order?.id, order?.status, summary?.balance]);
  useEffect(() => { setNextStatus(order ? nextStatuses[order.status][0] : undefined); }, [order?.id, order?.status]);
  const submitPayment = async (values: { amount: number; method: PaymentMethod; note?: string }): Promise<void> => {
    if (!order) return;
    try { await createPayment({ id: order.id, ...values }).unwrap(); form.resetFields(); message.success('Đã ghi nhận thanh toán.'); } catch (error: unknown) { message.error(getErrorMessage(error)); }
  };
  const submitStatus = async (): Promise<void> => {
    if (!order || !nextStatus) return;
    try { await updateStatus({ id: order.id, status: nextStatus }).unwrap(); message.success('Đã cập nhật tiến độ đơn hàng.'); } catch (error: unknown) { message.error(getErrorMessage(error)); }
  };
  const confirmStatusChange = (): void => {
    if (!order || !nextStatus) return;
    Modal.confirm({
      centered: true,
      icon: <ExclamationCircleOutlined />,
      title: 'Xác nhận cập nhật tiến độ',
      content: <>Đơn <strong>{order.code}</strong> sẽ chuyển từ <strong>{orderStatusLabels[order.status]}</strong> sang <strong>{orderStatusLabels[nextStatus]}</strong>. Thay đổi này sẽ được ghi vào lịch sử đơn hàng.</>,
      okText: 'Xác nhận cập nhật',
      cancelText: 'Quay lại',
      onOk: submitStatus,
    });
  };
  const focusPayment = (): void => {
    form.setFieldValue('amount', summary?.balance);
    paymentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return <Modal centered className="order-detail-modal" width={900} open={Boolean(orderId)} onCancel={onClose} footer={null} title={order ? <div className="order-detail__heading"><Avatar>{order.customer.name.slice(0, 1).toUpperCase()}</Avatar><div><span>ĐƠN HÀNG</span><strong>{order.code}</strong><em><PhoneOutlined /> {order.customer.name} · {order.customer.phone}</em></div><div className="order-detail__heading-tags"><Tag color={order.orderType === 'READY_SALE' ? 'green' : 'blue'}>{orderTypeLabels[order.orderType]}</Tag><Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag></div></div> : 'Chi tiết đơn hàng'}>
    {isLoading ? <div className="order-detail-drawer__loading"><Spin /></div> : null}
    {isError ? <Empty description="Không thể tải chi tiết đơn hàng." /> : null}
    {order && summary ? <>
      <section className="order-detail__overview"><div className="order-detail__overview-heading"><div><strong>Thanh toán</strong><span>Kiểm tra nhanh tổng tiền và khoản còn phải thu.</span></div><div className="order-detail__payment-action"><Tag color={summary.balance === 0 ? 'green' : summary.paid > 0 ? 'orange' : 'default'}>Thanh toán: {summary.label}</Tag>{summary.balance > 0 ? <Button type="primary" onClick={focusPayment}>Thu {formatMoney(summary.balance)}</Button> : null}</div></div><div className="order-detail__money-cards"><div><span>Tổng đơn</span><strong>{formatMoney(order.total)}</strong></div><div><span>Đã thu</span><strong>{formatMoney(summary.paid)}</strong></div><div className={summary.balance > 0 ? 'order-detail__money-card--due' : 'order-detail__money-card--settled'}><span>{summary.balance > 0 ? 'Còn phải thu' : 'Thanh toán'}</span><strong>{summary.balance > 0 ? formatMoney(summary.balance) : 'Đã đủ'}</strong></div></div></section>
      <section className="order-detail-section"><div className="order-detail-section__heading"><div><strong>Tiến độ gia công / giao hàng</strong><span>Trạng thái này độc lập với tình trạng thanh toán ở trên.</span></div><Tag color={orderStatusColors[order.status]}>Tiến độ: {orderStatusLabels[order.status]}</Tag></div>{nextStatuses[order.status].length ? <Space.Compact className="order-status-control"><Select value={nextStatus} onChange={setNextStatus} options={nextStatuses[order.status].map((value) => ({ value, label: orderStatusLabels[value] }))} /><Button type="primary" loading={updateStatusState.isLoading} onClick={confirmStatusChange}>Cập nhật</Button></Space.Compact> : <span className="order-status-finished">Đơn đã ở trạng thái cuối, không thể chuyển tiếp.</span>}</section>
      <section className="order-detail-section"><div className="order-detail-section__heading"><div><strong><ShoppingOutlined /> Sản phẩm trong đơn</strong><span>{order.items.length} mặt hàng đã chọn cho khách.</span></div></div><div className="order-detail__item-table" role="table" aria-label="Sản phẩm trong đơn"><div className="order-detail__item-table-head" role="row"><span role="columnheader">Sản phẩm</span><span role="columnheader">SL</span><span role="columnheader">Đơn giá</span><span role="columnheader">Thành tiền</span></div><List size="small" bordered dataSource={order.items} renderItem={(item) => <List.Item role="row"><span role="cell">{item.name}</span><span role="cell">{item.qty}</span><span role="cell">{formatMoney(item.unitPrice)}</span><strong role="cell">{formatMoney(item.unitPrice * item.qty)}</strong></List.Item>} /></div><div className="order-order-summary"><span>Tạm tính <b>{formatMoney(order.subtotal)}</b></span><span>Chiết khấu <b>−{formatMoney(order.discount)}</b></span><strong>Tổng đơn <b>{formatMoney(order.total)}</b></strong></div></section>
      <section className="order-detail-section"><div className="order-detail-section__heading"><div><strong>Lịch sử thanh toán</strong><span>Tiền cọc và các lần thu thêm của đơn.</span></div><Tag color={summary.balance === 0 ? 'green' : summary.paid > 0 ? 'orange' : 'default'}>{summary.label}</Tag></div>{order.deposit > 0 ? <List size="small" dataSource={[{ id: 'deposit', amount: order.deposit, method: order.depositMethod, paidAt: order.createdAt, note: 'Tiền cọc khi tạo đơn' }]} renderItem={(payment) => <List.Item><span>{formatMoney(payment.amount)} · {payment.method ? paymentMethodLabels[payment.method] : '—'} · {formatDateTime(payment.paidAt)}</span><span>{payment.note}</span></List.Item>} /> : null}{order.payments.length ? <List size="small" dataSource={order.payments} renderItem={(payment) => <List.Item><span>{payment.type === 'REFUND' ? '−' : ''}{formatMoney(payment.amount)} · {payment.type === 'REFUND' ? 'Hoàn tiền' : 'Thanh toán'} · {paymentMethodLabels[payment.method]} · {formatDateTime(payment.paidAt)}</span><span>{payment.note || '—'}</span></List.Item>} /> : null}{order.status !== 'CANCELLED' && summary.balance > 0 ? <div ref={paymentFormRef}><Form className="order-payment-form" form={form} layout="vertical" onFinish={submitPayment}><div className="order-payment-form__grid"><Form.Item name="amount" label="Thu thêm (đ)" rules={[{ required: true, message: 'Nhập số tiền.' }, { type: 'number', min: 1, max: summary.balance, message: `Tối đa ${formatMoney(summary.balance)}.` }]}><InputNumber min={1} max={summary.balance} precision={0} inputMode="numeric" formatter={formatVndInput} parser={parseVndInput} style={{ width: '100%' }} {...integerOnlyInputProps} /></Form.Item><Form.Item name="method" label="Hình thức" rules={[{ required: true, message: 'Chọn hình thức.' }]}><Select options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} /></Form.Item></div><Form.Item name="note" label="Ghi chú"><Input maxLength={500} /></Form.Item><Button type="primary" htmlType="submit" loading={createPaymentState.isLoading}>Ghi nhận thanh toán</Button></Form></div> : null}</section>
      {order.statusHistory.length ? <section className="order-detail-section"><div className="order-detail-section__heading"><div><strong>Lịch sử tiến độ</strong><span>Ghi nhận các lần chuyển trạng thái của đơn.</span></div></div><List size="small" dataSource={order.statusHistory} renderItem={(entry) => <List.Item><span>{entry.fromStatus ? `${orderStatusLabels[entry.fromStatus]} → ` : ''}<Tag color={orderStatusColors[entry.toStatus]}>{orderStatusLabels[entry.toStatus]}</Tag></span><span>{formatDateTime(entry.createdAt)}{entry.createdBy ? ` · ${entry.createdBy.name}` : ''}</span></List.Item>} /></section> : null}
      <section className="order-detail-section order-detail-section--facts"><div className="order-detail__facts"><div><span>Khách hàng</span><strong>{order.customer.name}</strong><a href={`tel:${order.customer.phone}`}><PhoneOutlined /> {order.customer.phone}</a></div><div><span>Hẹn giao / bảo hành</span><strong>{order.dueDate ? `Hẹn giao ${formatDate(order.dueDate)}` : 'Chưa hẹn giao'}</strong><em>Bảo hành đến {formatDate(order.warrantyUntil)}</em><em>Tạo {formatDateTime(order.createdAt)}{order.createdBy ? ` · ${order.createdBy.name}` : ''}</em></div><div className="order-detail__fact--note"><span>Ghi chú</span><strong>{order.note || 'Không có ghi chú.'}</strong>{order.cancellationReason ? <em>Lý do hủy: {order.cancellationReason}</em> : null}</div></div></section>
    </> : null}
  </Modal>;
}
