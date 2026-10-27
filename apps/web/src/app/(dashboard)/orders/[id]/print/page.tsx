'use client';

import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Spin, Tag } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { orderStatusColors, orderStatusLabels, type Order, useOrderQuery } from '@/store/api';

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : '—';
const paidAmount = (order: Order): number => order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount), 0);

export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useOrderQuery(id);
  if (isLoading || !order) return <Spin size="large" />;
  const paid = paidAmount(order);

  return <div className="print-sheet order-print">
    <div className="no-print order-print__actions"><Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>Quay lại</Button><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>In phiếu</Button></div>
    <Card className="surface-card">
      <div className="order-print__header"><div><p>PHIẾU ĐƠN HÀNG</p><h1>{order.code}</h1></div><Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag></div>
      <Descriptions size="small" column={2} items={[
        { key: 'customer', label: 'Khách hàng', children: order.customer.name },
        { key: 'phone', label: 'Số điện thoại', children: order.customer.phone },
        { key: 'created', label: 'Ngày tạo', children: formatDate(order.createdAt) },
        { key: 'warranty', label: 'Bảo hành đến', children: formatDate(order.warrantyUntil) },
      ]} />
      <table className="rx-print order-print__table"><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.qty}</td><td>{formatMoney(item.unitPrice)}</td><td>{formatMoney(item.unitPrice * item.qty)}</td></tr>)}</tbody></table>
      <div className="order-print__totals"><span>Tạm tính <b>{formatMoney(order.subtotal)}</b></span><span>Chiết khấu <b>−{formatMoney(order.discount)}</b></span><strong>Tổng đơn <b>{formatMoney(order.total)}</b></strong><span>Đã thanh toán <b>{formatMoney(paid)}</b></span><strong>Còn phải thu <b>{formatMoney(Math.max(0, order.total - paid))}</b></strong></div>
      {order.note ? <p className="order-print__note"><b>Ghi chú:</b> {order.note}</p> : null}
    </Card>
  </div>;
}
