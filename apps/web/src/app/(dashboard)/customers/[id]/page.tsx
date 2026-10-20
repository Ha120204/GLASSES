'use client';

import { ArrowLeftOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Spin, Table, Tabs, Tag } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useCustomerQuery } from '@/store/api';
import { CustomerEyeExamTab } from '@/components/customer-eye-exam-tab';

const statusLabels: Record<string, string> = {
  NEW: 'Mới',
  LENS_ORDERED: 'Đã đặt tròng',
  PROCESSING: 'Đang gia công',
  READY: 'Sẵn sàng giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useCustomerQuery(params.id);
  if (isLoading)
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        <Spin size="large" />
      </div>
    );
  if (isError || !data)
    return (
      <Card className="surface-card">
        <Empty description="Không thể tìm thấy khách hàng.">
          <Button onClick={() => router.push('/customers')}>Về danh sách khách hàng</Button>
        </Empty>
      </Card>
    );
  const items = [
    {
      key: 'info',
      label: 'Thông tin',
      children: (
        <Descriptions
          column={{ xs: 1, sm: 2 }}
          bordered
          size="small"
          items={[
            { key: 'phone', label: 'Số điện thoại', children: data.phone },
            {
              key: 'gender',
              label: 'Giới tính',
              children:
                data.gender === 'MALE'
                  ? 'Nam'
                  : data.gender === 'FEMALE'
                    ? 'Nữ'
                    : data.gender === 'OTHER'
                      ? 'Khác'
                      : '—',
            },
            {
              key: 'birthday',
              label: 'Ngày sinh',
              children: data.birthday
                ? new Intl.DateTimeFormat('vi-VN').format(new Date(data.birthday))
                : '—',
            },
            { key: 'address', label: 'Địa chỉ', children: data.address || '—' },
            { key: 'note', label: 'Ghi chú', children: data.note || '—', span: 2 },
          ]}
        />
      ),
    },
    {
      key: 'exam',
      label: `Đơn kính (${data.eyeExams.length})`,
      children: <CustomerEyeExamTab customerId={data.id} />,
    },
    {
      key: 'orders',
      label: `Lịch sử mua (${data.orders.length})`,
      children: data.orders.length ? (
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={data.orders}
          columns={[
            { title: 'Mã đơn', dataIndex: 'code' },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              render: (status: string) => <Tag color="blue">{statusLabels[status] ?? status}</Tag>,
            },
            {
              title: 'Tổng tiền',
              dataIndex: 'total',
              align: 'right',
              render: (total: number) => `${total.toLocaleString('vi-VN')} ₫`,
            },
          ]}
        />
      ) : (
        <Empty description="Chưa có lịch sử mua hàng." />
      ),
    },
    {
      key: 'notes',
      label: 'Ghi chú',
      children: data.note ? <Card>{data.note}</Card> : <Empty description="Chưa có ghi chú." />,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/customers')}
            style={{ paddingLeft: 0 }}
          >
            Khách hàng
          </Button>
          <h1>{data.name}</h1>
          <p>
            <PhoneOutlined /> {data.phone}
          </p>
        </div>
        <Button icon={<EditOutlined />}>Chỉnh sửa</Button>
      </div>
      <Card className="surface-card">
        <Tabs items={items} />
      </Card>
    </>
  );
}
