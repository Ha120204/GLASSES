'use client';

import {
  CalendarOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  PhoneOutlined,
  ShoppingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Empty, Modal, Spin, Table, Tabs, Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { CustomerEyeExamTab } from '@/components/customer-eye-exam-tab';
import { orderStatusColors, orderStatusLabels, type Customer, type CustomerDetail, type OrderStatus, useCustomerQuery } from '@/store/api';

interface CustomerProfileModalProps {
  customerId: string | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

const genderLabels: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
const formatDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)) : 'Chưa cập nhật';
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
const formatOrderDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const formatOrderTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

function CustomerInfo({ customer }: { customer: CustomerDetail }) {
  return <section className="customer-profile__info">
    <div className="customer-profile__section-heading">
      <span className="customer-profile__section-icon"><UserOutlined /></span>
      <div><strong>Thông tin khách hàng</strong><span>Thông tin liên hệ và ghi chú phục vụ chăm sóc khách.</span></div>
    </div>
    <div className="customer-profile__info-grid">
      <div className="customer-profile__info-item"><span><PhoneOutlined /> Số điện thoại</span><strong>{customer.phone}</strong></div>
      <div className="customer-profile__info-item"><span><CalendarOutlined /> Ngày sinh</span><strong>{formatDate(customer.birthday)}</strong></div>
      <div className="customer-profile__info-item"><span><UserOutlined /> Giới tính</span><strong>{customer.gender ? genderLabels[customer.gender] ?? customer.gender : 'Chưa cập nhật'}</strong></div>
      <div className="customer-profile__info-item customer-profile__info-item--wide"><span><EnvironmentOutlined /> Địa chỉ</span><strong>{customer.address || 'Chưa cập nhật'}</strong></div>
      <div className="customer-profile__info-item customer-profile__info-item--wide"><span><FileTextOutlined /> Ghi chú</span><strong>{customer.note || 'Chưa có ghi chú'}</strong></div>
    </div>
  </section>;
}

function CustomerOrders({ customer, onViewAll, onViewOrder }: { customer: CustomerDetail; onViewAll: () => void; onViewOrder: (order: CustomerDetail['orders'][number]) => void }) {
  const ordersTotal = customer.ordersTotal ?? customer.orders.length;
  if (!customer.orders.length) return <Empty description="Chưa có đơn hàng nào." />;
  return <section className="customer-profile__orders">
    <div className="customer-profile__section-heading">
      <span className="customer-profile__section-icon"><ShoppingOutlined /></span>
      <div><strong>Đơn hàng gần đây</strong><span>Tối đa 10 đơn mới nhất · Đơn lưu trữ vẫn có thể xem chi tiết.</span></div>
    </div>
    <Table
      className="customer-profile__orders-table"
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={customer.orders}
      scroll={{ x: 850 }}
      columns={[
        { title: 'Ngày đặt', dataIndex: 'createdAt', width: 112, render: (createdAt: string) => <div className="customer-profile__order-date"><strong>{formatOrderDate(createdAt)}</strong><span>{formatOrderTime(createdAt)}</span></div> },
        { title: 'Mã đơn', dataIndex: 'code', width: 177, render: (code: string) => <strong className="customer-profile__order-code">{code}</strong> },
        { title: 'Sản phẩm', dataIndex: 'items', ellipsis: true, render: (items: CustomerDetail['orders'][number]['items']) => <div className="customer-profile__order-product" title={items.map((item) => item.name).join(', ')}><strong>{items[0]?.name ?? 'Chưa có sản phẩm'}</strong>{items.length > 1 ? <span>+{items.length - 1} sản phẩm khác</span> : null}</div> },
        { title: 'Trạng thái', dataIndex: 'status', width: 205, render: (status: OrderStatus, order: CustomerDetail['orders'][number]) => <div className="customer-profile__order-tags"><Tag color={orderStatusColors[status]}>{orderStatusLabels[status]}</Tag>{order.archivedAt ? <Tag>Đã lưu trữ</Tag> : null}</div> },
        { title: 'Giá trị đơn', dataIndex: 'total', width: 125, align: 'right', render: (total: number) => <strong className="customer-profile__order-total">{formatMoney(total)}</strong> },
        { title: '', key: 'view', width: 62, align: 'center', render: (_: unknown, order: CustomerDetail['orders'][number]) => <Button type="text" icon={<EyeOutlined />} aria-label={`Xem chi tiết đơn ${order.code}`} title="Xem chi tiết" onClick={() => onViewOrder(order)} /> },
      ]}
    />
    <div className="customer-profile__order-cards">
      {customer.orders.map((order) => <div className="customer-profile__order-card" key={order.id}>
        <div className="customer-profile__order-card-top"><div className="customer-profile__order-date"><strong>{formatOrderDate(order.createdAt)}</strong><span>{formatOrderTime(order.createdAt)}</span></div><div className="customer-profile__order-tags"><Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag>{order.archivedAt ? <Tag>Đã lưu trữ</Tag> : null}</div></div>
        <strong className="customer-profile__order-code">{order.code}</strong>
        <div className="customer-profile__order-product"><strong>{order.items[0]?.name ?? 'Chưa có sản phẩm'}</strong>{order.items.length > 1 ? <span>+{order.items.length - 1} sản phẩm khác</span> : null}</div>
        <div className="customer-profile__order-card-bottom"><strong>{formatMoney(order.total)}</strong><Button type="link" onClick={() => onViewOrder(order)}>Xem chi tiết</Button></div>
      </div>)}
    </div>
    {ordersTotal > customer.orders.length ? <Button className="customer-profile__orders-link" type="link" onClick={onViewAll}>
      Mở danh sách đơn của khách
    </Button> : null}
  </section>;
}

export function CustomerProfileModal({ customerId, onClose, onEdit }: CustomerProfileModalProps) {
  const router = useRouter();
  const { data: customer, isLoading, isError } = useCustomerQuery(customerId ?? '', { skip: !customerId });
  const open = Boolean(customerId);
  const ordersTotal = customer?.ordersTotal ?? customer?.orders.length ?? 0;
  const openOrderForm = (): void => {
    if (!customer) return;
    onClose();
    router.push(`/orders?customerId=${customer.id}&create=1`);
  };
  const viewAllOrders = (): void => {
    if (!customer) return;
    onClose();
    router.push(`/orders?customerId=${customer.id}`);
  };
  const viewOrder = (order: CustomerDetail['orders'][number]): void => {
    if (!customer) return;
    onClose();
    const query = new URLSearchParams({ customerId: customer.id, orderId: order.id });
    if (order.archivedAt) query.set('archiveView', 'ARCHIVED');
    else if (order.status === 'CANCELLED') query.set('status', 'CANCELLED');
    router.push(`/orders?${query.toString()}`);
  };

  const tabItems = customer ? [
    { key: 'info', label: 'Thông tin', children: <CustomerInfo customer={customer} /> },
    { key: 'exams', label: `Phiếu đo mắt (${customer.eyeExams.length})`, children: <CustomerEyeExamTab customerId={customer.id} exams={customer.eyeExams} /> },
    { key: 'orders', label: `Đơn gần đây (${ordersTotal})`, children: <CustomerOrders customer={customer} onViewAll={viewAllOrders} onViewOrder={viewOrder} /> },
  ] : [];

  return <Modal
    className="customer-profile-modal"
    open={open}
    centered
    onCancel={onClose}
    destroyOnHidden
    width={1020}
    footer={<Button onClick={onClose}>Đóng</Button>}
    title={customer ? <div className="customer-profile__heading">
      <Avatar>{customer.name.slice(0, 1).toUpperCase()}</Avatar>
      <div>
        <span>HỒ SƠ KHÁCH HÀNG</span>
        <strong>{customer.name}</strong>
        <em><PhoneOutlined /> {customer.phone}</em>
      </div>
    </div> : 'Hồ sơ khách hàng'}
  >
    {isLoading && !customer ? <div className="customer-profile__loading"><Spin size="large" /></div> : null}
    {isError && !customer ? <Empty description="Không thể tải hồ sơ khách hàng." /> : null}
    {customer ? <>
      <div className="customer-profile__summary">
        <div><span>Lần đo gần nhất</span><strong>{customer.latestEyeExam ? formatDate(customer.latestEyeExam.examDate) : 'Chưa có'}</strong></div>
        <div><span>Tổng đơn hàng</span><strong>{ordersTotal}</strong></div>
        <div><span>Khách hàng từ</span><strong>{formatDate(customer.createdAt)}</strong></div>
      </div>
      <div className="customer-profile__action-bar">
        <div><strong>Thao tác nhanh</strong><span>Tạo đơn mới hoặc cập nhật thông tin hồ sơ.</span></div>
        <div className="customer-profile__actions">
          <Button className="customer-profile__edit" icon={<EditOutlined />} onClick={() => onEdit(customer)}>Chỉnh sửa hồ sơ</Button>
          <Button className="customer-profile__create-order" type="primary" icon={<ShoppingOutlined />} onClick={openOrderForm}>Tạo đơn cho khách</Button>
        </div>
      </div>
      <Tabs className="customer-profile__tabs" items={tabItems} />
    </> : null}
  </Modal>;
}
