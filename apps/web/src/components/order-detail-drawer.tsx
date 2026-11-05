'use client';

import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PhoneOutlined,
  QrcodeOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Spin,
  Tag,
  message,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  getErrorMessage,
  orderStatusColors,
  orderStatusLabels,
  orderTypeLabels,
  paymentMethodLabels,
  type Order,
  type PaymentMethod,
  useCreateOrderPaymentMutation,
  useOrderQuery,
  useUpdateOrderStatusMutation,
} from '@/store/api';
import { formatVndInput, integerOnlyInputProps, parseVndInput } from '@/lib/money-input';
import { PaymentQrModal } from '@/components/payment-qr-modal';

interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
  onShareZalo: (order: Order) => void;
}
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
const paymentSummary = (order: Order) => {
  const paid =
    order.deposit +
    order.payments.reduce(
      (sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount),
      0,
    );
  if (order.status === 'CANCELLED')
    return {
      paid,
      balance: 0,
      label: order.payments.some((payment) => payment.type === 'REFUND')
        ? 'Đã hoàn tiền'
        : 'Đã hủy',
    };
  const balance = Math.max(0, order.total - paid);
  return {
    paid,
    balance,
    label: paid === 0 ? 'Chưa thanh toán' : balance === 0 ? 'Đã thanh toán' : 'Đã cọc',
  };
};

const orderAuditFieldLabels: Record<string, string> = {
  customerId: 'khách hàng',
  eyeExamId: 'phiếu đo mắt',
  subtotal: 'tạm tính',
  discount: 'chiết khấu',
  total: 'tổng đơn',
  dueDate: 'ngày hẹn lấy kính',
  warrantyUntil: 'hạn bảo hành',
  note: 'ghi chú',
  items: 'sản phẩm',
};

const formatOrderAuditSummary = (action: 'UPDATED' | 'ARCHIVED' | 'RESTORED', changes: Record<string, unknown> | null): string => {
  if (action === 'ARCHIVED') return 'Đã lưu trữ đơn hàng.';
  if (action === 'RESTORED') return 'Đã khôi phục đơn hàng.';
  const labels = Object.keys(changes ?? {}).map((field) => orderAuditFieldLabels[field] ?? field);
  return labels.length ? `Đã cập nhật: ${labels.join(', ')}.` : 'Đã lưu lại đơn hàng.';
};

interface PaymentCollectionModalProps {
  order: Order;
  balance: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { idempotencyKey: string; amount: number; method: PaymentMethod; note?: string }) => Promise<boolean>;
  onQrConfirm: (amount: number) => Promise<boolean>;
}

function PaymentCollectionModal({ order, balance, loading, onClose, onSubmit, onQrConfirm }: PaymentCollectionModalProps) {
  const [form] = Form.useForm<{ amount: number; method: PaymentMethod; note?: string }>();
  const [qrOpen, setQrOpen] = useState(false);
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    form.setFieldsValue({ amount: balance, method: 'CASH', note: undefined });
  }, [balance, form, order.id]);

  const submit = async (values: { amount: number; method: PaymentMethod; note?: string }): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    requestKey.current ??= crypto.randomUUID();
    try { if (await onSubmit({ ...values, idempotencyKey: requestKey.current })) form.resetFields(); }
    finally { submitting.current = false; }
  };
  const confirmQr = async (amount: number): Promise<void> => {
    if (await onQrConfirm(amount)) setQrOpen(false);
  };

  return <>
    <Modal className="order-payment-modal" centered footer={null} open width={520} zIndex={1050} onCancel={onClose} title="Ghi nhận thanh toán">
      <div className="order-payment-modal__summary"><span>Còn phải thu</span><strong>{formatMoney(balance)}</strong><small>Đơn {order.code}</small></div>
      <Form className="order-payment-form" form={form} layout="vertical" onValuesChange={() => { requestKey.current = null; }} onFinish={submit}>
        <div className="order-payment-form__grid">
          <Form.Item name="amount" label="Số tiền thu (đ)" rules={[{ required: true, message: 'Nhập số tiền.' }, { type: 'number', min: 1, max: balance, message: `Tối đa ${formatMoney(balance)}.` }]}>
            <InputNumber min={1} max={balance} precision={0} inputMode="numeric" formatter={formatVndInput} parser={parseVndInput} style={{ width: '100%' }} {...integerOnlyInputProps} />
          </Form.Item>
          <Form.Item name="method" label="Hình thức nhận tiền" rules={[{ required: true, message: 'Chọn hình thức.' }]}>
            <Select options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
        </div>
        <Form.Item name="note" label="Ghi chú (không bắt buộc)"><Input maxLength={500} placeholder="Ví dụ: khách thanh toán phần còn lại" /></Form.Item>
        <div className="order-payment-modal__actions">
          <Button onClick={onClose}>Hủy</Button>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.method !== current.method}>
            {({ getFieldValue }) => getFieldValue('method') === 'TRANSFER' ? <Button icon={<QrcodeOutlined />} onClick={() => void form.validateFields(['amount']).then(() => setQrOpen(true)).catch(() => undefined)}>Tạo QR chuyển khoản</Button> : null}
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>Ghi nhận thanh toán</Button>
        </div>
      </Form>
    </Modal>
    <PaymentQrModal open={qrOpen} order={order} balance={balance} initialAmount={form.getFieldValue('amount')} onClose={() => setQrOpen(false)} onConfirm={confirmQr} confirming={loading} requireFullPayment={order.status === 'AWAITING_PAYMENT'} confirmLabel={order.status === 'AWAITING_PAYMENT' ? 'Đã nhận tiền & hoàn tất' : undefined} />
  </>;
}

export function OrderDetailDrawer({ orderId, onClose, onEdit, onCancelOrder, onShareZalo }: OrderDetailDrawerProps) {
  const { data: order, isLoading, isError } = useOrderQuery(orderId ?? '', { skip: !orderId });
  const [createPayment, createPaymentState] = useCreateOrderPaymentMutation();
  const [updateStatus, updateStatusState] = useUpdateOrderStatusMutation();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false);
  const qrRequest = useRef<{ orderId: string; amount: number; key: string } | null>(null);
  useEffect(() => {
    setPaymentOpen(false);
    setDeliveryConfirmOpen(false);
    qrRequest.current = null;
  }, [orderId]);
  const summary = order ? paymentSummary(order) : null;
  const deliveryBlocked = order?.status === 'IN_PROGRESS' && (summary?.balance ?? 0) > 0;
  const awaitingQrPayment = order?.status === 'AWAITING_PAYMENT';
  const canManageActiveOrder = order?.status === 'IN_PROGRESS' || awaitingQrPayment;
  const visibleStatusHistory = order?.statusHistory.filter(
    (entry) => !entry.fromStatus || entry.fromStatus !== entry.toStatus,
  ) ?? [];
  const recordQrPayment = async (amount: number): Promise<boolean> => {
    if (!order) return false;
    if (qrRequest.current?.orderId !== order.id || qrRequest.current.amount !== amount) qrRequest.current = { orderId: order.id, amount, key: crypto.randomUUID() };
    try {
      await createPayment({
        id: order.id,
        idempotencyKey: qrRequest.current.key,
        amount,
        method: 'TRANSFER',
        note: 'Thanh toán QR · ' + order.code,
      }).unwrap();
      message.success(order.status === 'AWAITING_PAYMENT' ? 'Đã nhận chuyển khoản và hoàn tất đơn hàng.' : 'Đã ghi nhận thanh toán chuyển khoản.');
      setPaymentOpen(false);
      qrRequest.current = null;
      return true;
    } catch (error: unknown) {
      message.error(getErrorMessage(error));
      return false;
    }
  };
  const submitPayment = async (values: {
    idempotencyKey: string;
    amount: number;
    method: PaymentMethod;
    note?: string;
  }): Promise<boolean> => {
    if (!order) return false;
    try {
      await createPayment({ id: order.id, ...values }).unwrap();
      setPaymentOpen(false);
      message.success('Đã ghi nhận thanh toán.');
      return true;
    } catch (error: unknown) {
      message.error(getErrorMessage(error));
      return false;
    }
  };
  const submitDelivery = async (): Promise<void> => {
    if (!order) return;
    try {
      await updateStatus({ id: order.id, status: 'DELIVERED' }).unwrap();
      message.success('Đã giao kính và hoàn tất đơn hàng.');
      setDeliveryConfirmOpen(false);
    } catch (error: unknown) {
      message.error(getErrorMessage(error));
    }
  };
  const openPayment = (): void => {
    setPaymentOpen(true);
  };
  return (
    <Modal
      centered
      className="order-detail-modal"
      width={900}
      open={Boolean(orderId)}
      onCancel={onClose}
      footer={null}
      title={
        order ? (
          <div className="order-detail__heading">
            <Avatar>{order.customer.name.slice(0, 1).toUpperCase()}</Avatar>
            <div>
              <span>ĐƠN HÀNG</span>
              <strong>{order.code}</strong>
              <em>
                <PhoneOutlined /> {order.customer.name} · {order.customer.phone}
              </em>
            </div>
            <div className="order-detail__heading-tags">
              <Tag color={order.orderType === 'READY_SALE' ? 'green' : 'blue'}>
                {orderTypeLabels[order.orderType]}
              </Tag>
              <Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag>
              {order.archivedAt ? <Tag color="default">Đã lưu trữ</Tag> : null}
            </div>
          </div>
        ) : (
          'Chi tiết đơn hàng'
        )
      }
    >
      {isLoading ? (
        <div className="order-detail-drawer__loading">
          <Spin />
        </div>
      ) : null}
      {isError ? <Empty description="Không thể tải chi tiết đơn hàng." /> : null}
      {order && summary ? (
        <>
          <section className="order-detail__overview">
            <div className="order-detail__overview-heading">
              <div>
                <strong>Thanh toán</strong>
                <span>Kiểm tra nhanh tổng tiền và khoản còn phải thu.</span>
              </div>
              <div className="order-detail__payment-action">
                <Tag
                  color={summary.balance === 0 ? 'green' : summary.paid > 0 ? 'orange' : 'default'}
                >
                  Thanh toán: {summary.label}
                </Tag>
                {summary.balance > 0 ? (
                  <Button type="primary" onClick={openPayment}>
                    Thu {formatMoney(summary.balance)}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="order-detail__money-cards">
              <div>
                <span>Tổng đơn</span>
                <strong>{formatMoney(order.total)}</strong>
              </div>
              <div>
                <span>Đã thu</span>
                <strong>{formatMoney(summary.paid)}</strong>
              </div>
              <div
                className={
                  summary.balance > 0
                    ? 'order-detail__money-card--due'
                    : 'order-detail__money-card--settled'
                }
              >
                <span>{summary.balance > 0 ? 'Còn phải thu' : 'Thanh toán'}</span>
                <strong>{summary.balance > 0 ? formatMoney(summary.balance) : 'Đã đủ'}</strong>
              </div>
            </div>
          </section>
          <section className="order-detail-section">
            <div className="order-detail-section__heading">
              <div>
                <strong>Hoàn tất đơn hàng</strong>
                <span>Giao kính sau khi đã kiểm tra và thu đủ tiền của đơn.</span>
              </div>
              <Tag color={orderStatusColors[order.status]}>
                Tình trạng: {orderStatusLabels[order.status]}
              </Tag>
            </div>
            {awaitingQrPayment ? (
              <div className="order-delivery-action">
                <div>
                  <strong>Cần xác nhận đã nhận {formatMoney(summary.balance)}</strong>
                  <span>Mở luồng thu tiền ở phần Thanh toán, sau đó kiểm tra tiền vào tài khoản trước khi hoàn tất đơn.</span>
                </div>
              </div>
            ) : order.status === 'IN_PROGRESS' ? (
              <div className="order-delivery-action">
                <div>
                  <strong>
                    {deliveryBlocked ? `Còn phải thu ${formatMoney(summary.balance)}` : 'Đơn đã thanh toán đủ'}
                  </strong>
                  <span>
                    {deliveryBlocked
                      ? 'Ghi nhận thanh toán trước khi giao kính cho khách.'
                      : 'Xác nhận khách đã nhận kính để hoàn tất đơn.'}
                  </span>
                </div>
                <Button
                  type="primary"
                  disabled={deliveryBlocked}
                  loading={updateStatusState.isLoading}
                  onClick={() => setDeliveryConfirmOpen(true)}
                >
                  Giao kính · hoàn tất đơn
                </Button>
              </div>
            ) : (
              <span className="order-status-finished">
                {order.status === 'DELIVERED'
                  ? 'Đơn đã giao kính và hoàn tất.'
                  : 'Đơn đã hủy, không thể thực hiện thêm thao tác giao hàng.'}
              </span>
            )}
            {deliveryBlocked ? (
              <div className="order-status-payment-warning">
                <span>Cần thu đủ {formatMoney(summary.balance)} trước khi giao kính và hoàn tất đơn.</span>
              </div>
            ) : null}
            {canManageActiveOrder ? (
              <div className="order-detail__order-actions">
                <Button icon={<EditOutlined />} onClick={() => onEdit(order)}>Sửa đơn</Button>
                {order.orderType === 'PREORDER' ? (
                  <Button icon={<MessageOutlined />} onClick={() => onShareZalo(order)}>Chuẩn bị tin Zalo</Button>
                ) : null}
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onCancelOrder(order)}>
                  Hủy đơn
                </Button>
              </div>
            ) : null}
          </section>
          <section className="order-detail-section">
            <div className="order-detail-section__heading">
              <div>
                <strong>
                  <ShoppingOutlined /> Sản phẩm trong đơn
                </strong>
                <span>{order.items.length} mặt hàng đã chọn cho khách.</span>
              </div>
            </div>
            <div className="order-detail__item-table" role="table" aria-label="Sản phẩm trong đơn">
              <div className="order-detail__item-table-head" role="row">
                <span role="columnheader">Sản phẩm</span>
                <span role="columnheader">SL</span>
                <span role="columnheader">Đơn giá</span>
                <span role="columnheader">Thành tiền</span>
              </div>
              <List
                size="small"
                bordered
                dataSource={order.items}
                renderItem={(item) => (
                  <List.Item role="row">
                    <span className="order-detail__item-name" role="cell">
                      {item.name}
                    </span>
                    <span className="order-detail__item-quantity" role="cell">
                      <small className="order-detail__mobile-label">Số lượng</small> × {item.qty}
                    </span>
                    <span className="order-detail__item-unit-price" role="cell">
                      <small className="order-detail__mobile-label">Đơn giá</small>
                      {formatMoney(item.unitPrice)}
                    </span>
                    <strong className="order-detail__item-total" role="cell">
                      <small className="order-detail__mobile-label">Thành tiền</small>
                      {formatMoney(item.unitPrice * item.qty)}
                    </strong>
                  </List.Item>
                )}
              />
            </div>
            <div className="order-order-summary" aria-label="Tổng tiền đơn hàng">
              <span>
                Tạm tính <b>{formatMoney(order.subtotal)}</b>
              </span>
              <span>
                Chiết khấu <b>−{formatMoney(order.discount)}</b>
              </span>
              <strong>
                Tổng đơn <b>{formatMoney(order.total)}</b>
              </strong>
            </div>
          </section>
          <section className="order-detail-section">
            <div className="order-detail-section__heading">
              <div>
                <strong>Lịch sử giao dịch</strong>
                <span>Các khoản đặt cọc, thanh toán và hoàn tiền của đơn.</span>
              </div>
            </div>
            {order.deposit > 0 ? (
              <List
                size="small"
                dataSource={[
                  {
                    id: 'deposit',
                    amount: order.deposit,
                    method: order.depositMethod,
                    paidAt: order.createdAt,
                    note: 'Tiền cọc khi tạo đơn',
                  },
                ]}
                renderItem={(payment) => (
                  <List.Item>
                    <span>
                      {formatMoney(payment.amount)} ·{' '}
                      {payment.method ? paymentMethodLabels[payment.method] : '—'} ·{' '}
                      {formatDateTime(payment.paidAt)}
                    </span>
                    <span>{payment.note}</span>
                  </List.Item>
                )}
              />
            ) : null}
            {order.payments.length ? (
              <List
                size="small"
                dataSource={order.payments}
                renderItem={(payment) => (
                  <List.Item>
                    <span>
                      {payment.type === 'REFUND' ? '−' : ''}
                      {formatMoney(payment.amount)} ·{' '}
                      {payment.type === 'REFUND' ? 'Hoàn tiền' : 'Thanh toán'} ·{' '}
                      {paymentMethodLabels[payment.method]} · {formatDateTime(payment.paidAt)}
                    </span>
                    <span>{payment.note || '—'}</span>
                  </List.Item>
                )}
              />
            ) : null}
            {!order.deposit && !order.payments.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có giao dịch thanh toán." /> : null}
          </section>
          {visibleStatusHistory.length ? (
            <section className="order-detail-section">
              <div className="order-detail-section__heading">
                <div>
                  <strong>Lịch sử đơn hàng</strong>
                  <span>Các mốc tạo đơn, giao kính hoặc hủy đơn.</span>
                </div>
              </div>
              <List
                size="small"
                dataSource={visibleStatusHistory}
                renderItem={(entry) => (
                  <List.Item>
                    <span>
                      <Tag color={orderStatusColors[entry.toStatus]}>
                        {!entry.fromStatus
                          ? entry.toStatus === 'DELIVERED'
                            ? 'Bán và giao ngay'
                            : entry.toStatus === 'AWAITING_PAYMENT'
                              ? 'Tạo đơn chờ thanh toán QR'
                              : 'Tạo đơn'
                          : orderStatusLabels[entry.toStatus]}
                      </Tag>
                    </span>
                    <span>
                      {formatDateTime(entry.createdAt)}
                      {entry.createdBy ? ` · ${entry.createdBy.name}` : ''}
                    </span>
                  </List.Item>
                )}
              />
            </section>
          ) : null}
          {order.auditLogs?.length ? (
            <section className="order-detail-section">
              <div className="order-detail-section__heading">
                <div>
                  <strong>Lịch sử thay đổi</strong>
                  <span>Các lần chỉnh sửa, lưu trữ và khôi phục đơn hàng.</span>
                </div>
              </div>
              <List
                size="small"
                dataSource={order.auditLogs}
                renderItem={(entry) => (
                  <List.Item>
                    <span>{formatOrderAuditSummary(entry.action, entry.changes)}</span>
                    <span>
                      {formatDateTime(entry.createdAt)}
                      {entry.createdBy ? ` · ${entry.createdBy.name}` : ''}
                    </span>
                  </List.Item>
                )}
              />
            </section>
          ) : null}
          <section className="order-detail-section order-detail-section--facts">
            <div className="order-detail__facts">
              <div>
                <span>Khách hàng</span>
                <strong>{order.customer.name}</strong>
                <a href={`tel:${order.customer.phone}`}>
                  <PhoneOutlined /> {order.customer.phone}
                </a>
              </div>
              <div>
                <span>Nhận hàng / bảo hành</span>
                <strong>
                  {order.status === 'DELIVERED'
                    ? 'Đã giao kính · hoàn tất'
                    : order.status === 'CANCELLED'
                      ? 'Đơn đã hủy'
                      : order.orderType === 'READY_SALE'
                        ? 'Giao tại quầy · nhận ngay'
                        : order.dueDate
                          ? `Hẹn lấy ${formatDate(order.dueDate)}`
                          : 'Chưa hẹn lấy'}
                </strong>
                <em>Bảo hành đến {formatDate(order.warrantyUntil)}</em>
                <em>
                  Tạo {formatDateTime(order.createdAt)}
                  {order.createdBy ? ` · ${order.createdBy.name}` : ''}
                </em>
                {order.archivedAt ? <em>Lưu trữ {formatDateTime(order.archivedAt)}{order.archivedBy ? ` · ${order.archivedBy.name}` : ''}</em> : null}
              </div>
              <div className="order-detail__fact--note">
                <span>Ghi chú</span>
                <strong>{order.note || 'Không có ghi chú.'}</strong>
                {order.cancellationReason ? <em>Lý do hủy: {order.cancellationReason}</em> : null}
              </div>
            </div>
          </section>
        </>
      ) : null}
      {paymentOpen && order && summary ? <PaymentCollectionModal order={order} balance={summary.balance} loading={createPaymentState.isLoading} onClose={() => setPaymentOpen(false)} onSubmit={submitPayment} onQrConfirm={recordQrPayment} /> : null}
      <Modal
        className="order-action-confirm-modal"
        centered
        open={deliveryConfirmOpen}
        zIndex={1100}
        destroyOnHidden
        onCancel={() => setDeliveryConfirmOpen(false)}
        footer={
          <div className="order-action-confirm-modal__footer">
            <Button onClick={() => setDeliveryConfirmOpen(false)}>Quay lại</Button>
            <Button
              type="primary"
              loading={updateStatusState.isLoading}
              onClick={() => void submitDelivery()}
            >
              Xác nhận đã giao kính
            </Button>
          </div>
        }
      >
        {order ? (
          <div className="order-action-confirm-modal__content">
            <span className="order-action-confirm-modal__icon">
              <ShoppingOutlined />
            </span>
            <div className="order-action-confirm-modal__eyebrow">HOÀN TẤT ĐƠN HÀNG</div>
            <h2>Xác nhận đã giao kính</h2>
            <p>
              Khách đã nhận kính của đơn <strong>{order.code}</strong> và đơn đã được thanh toán đủ.
            </p>
            <div className="order-action-confirm-modal__notice">
              Sau khi xác nhận, đơn sẽ chuyển sang “Đã giao · hoàn tất” và được lưu trong lịch sử đơn hàng.
            </div>
          </div>
        ) : null}
      </Modal>
    </Modal>
  );
}
