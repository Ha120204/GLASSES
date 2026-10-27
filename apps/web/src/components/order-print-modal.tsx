'use client';

import { CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Empty, Modal, Spin, Tag } from 'antd';
import { orderStatusColors, orderStatusLabels, type Order, useOrderQuery } from '@/store/api';

interface OrderPrintModalProps {
  orderId: string | null;
  onClose: () => void;
}

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value)) : '—';
const paidAmount = (order: Order): number => order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0);

export function OrderPrintModal({ orderId, onClose }: OrderPrintModalProps) {
  const { data: order, isLoading, isError } = useOrderQuery(orderId ?? '', { skip: !orderId });
  const open = Boolean(orderId);
  const print = (): void => {
    const clearPrintClass = (): void => document.body.classList.remove('printing-order');
    document.body.classList.add('printing-order');
    window.addEventListener('afterprint', clearPrintClass, { once: true });
    window.print();
  };
  const paid = order ? paidAmount(order) : 0;
  const balance = order ? Math.max(0, order.total - paid) : 0;

  return <Modal
    className="order-print-modal"
    open={open}
    centered
    destroyOnHidden
    width={900}
    onCancel={onClose}
    title={<div className="order-print-modal__heading"><span><PrinterOutlined /></span><div><strong>Xem trước phiếu đơn hàng</strong><p>Kiểm tra nội dung trước khi in hoặc gửi cho khách.</p></div></div>}
    footer={<div className="order-print-modal__footer"><Button icon={<CloseOutlined />} onClick={onClose}>Đóng</Button><Button className="order-print-modal__print" type="primary" icon={<PrinterOutlined />} onClick={print} disabled={!order}>In phiếu đơn</Button></div>}
  >
    {isLoading ? <div className="order-print-modal__loading"><Spin size="large" /></div> : null}
    {isError ? <Empty description="Không thể tải dữ liệu phiếu in." /> : null}
    {order ? <article className="order-print-sheet">
      <header className="order-print-sheet__header"><div><span>PHIẾU ĐƠN HÀNG</span><h1>{order.code}</h1><p>Ngày tạo: {formatDate(order.createdAt)}</p></div><Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag></header>
      <section className="order-print-sheet__customer"><div><span>Khách hàng</span><strong>{order.customer.name}</strong></div><div><span>Số điện thoại</span><strong>{order.customer.phone}</strong></div></section>
      <section className="order-print-sheet__items"><h2>Sản phẩm trong đơn</h2><table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.qty}</td><td>{formatMoney(item.unitPrice)}</td><td>{formatMoney(item.unitPrice * item.qty)}</td></tr>)}</tbody></table></section>
      <section className="order-print-sheet__bottom"><div className="order-print-sheet__meta"><span><b>Bảo hành đến:</b> {formatDate(order.warrantyUntil)}</span>{order.note ? <span><b>Ghi chú:</b> {order.note}</span> : null}</div><div className="order-print-sheet__totals"><span>Tạm tính <b>{formatMoney(order.subtotal)}</b></span><span>Chiết khấu <b>−{formatMoney(order.discount)}</b></span><strong>Tổng đơn <b>{formatMoney(order.total)}</b></strong><span>Đã thanh toán <b>{formatMoney(paid)}</b></span><strong className={balance > 0 ? 'order-print-sheet__balance' : 'order-print-sheet__settled'}>{balance > 0 ? 'Còn phải thu' : 'Đã thanh toán đủ'} <b>{formatMoney(balance)}</b></strong></div></section>
      <footer><span>Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ.</span><span>Vui lòng giữ phiếu để đối chiếu khi cần.</span></footer>
    </article> : null}
  </Modal>;
}
