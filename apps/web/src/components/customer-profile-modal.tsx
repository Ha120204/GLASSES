'use client';

import {
  CalendarOutlined,
  EditOutlined,
  EnvironmentOutlined,
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

function CustomerOrders({ customer, onViewAll }: { customer: CustomerDetail; onViewAll: () => void }) {
  const ordersTotal = customer.ordersTotal ?? customer.orders.length;
  if (!customer.orders.length) return <Empty description="Chưa có đơn hàng nào." />;
  return <section className="customer-profile__orders">
    <div className="customer-profile__section-heading">
      <span className="customer-profile__section-icon"><ShoppingOutlined /></span>
      <div><strong>Đơn hàng gần đây</strong><span>Hiển thị tối đa 10 đơn gần nhất của khách hàng.</span></div>
    </div>
    <Table
      className="customer-profile__orders-table"
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={customer.orders}
      scroll={{ x: 580 }}
      columns={[
        { title: 'Mã đơn', dataIndex: 'code', render: (code: string) => <strong>{code}</strong> },
        { title: 'Trạng thái', dataIndex: 'status', render: (status: OrderStatus) => <Tag color={orderStatusColors[status]}>{orderStatusLabels[status]}</Tag> },
        { title: 'Tổng tiền', dataIndex: 'total', align: 'right', render: (total: number) => formatMoney(total) },
      ]}
    />
    {ordersTotal > customer.orders.length ? <Button className="customer-profile__orders-link" type="link" onClick={onViewAll}>
      Xem toàn bộ {ordersTotal} đơn hàng
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

  const tabItems = customer ? [
    { key: 'info', label: 'Thông tin', children: <CustomerInfo customer={customer} /> },
    { key: 'exams', label: `Phiếu đo mắt (${customer.eyeExams.length})`, children: <CustomerEyeExamTab customerId={customer.id} /> },
    { key: 'orders', label: `Đơn gần đây (${ordersTotal})`, children: <CustomerOrders customer={customer} onViewAll={viewAllOrders} /> },
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
