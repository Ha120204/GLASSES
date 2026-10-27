'use client';

import { ArrowLeftOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Spin, Table, Tabs, Tag, message } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { getErrorMessage, type CustomerInput, useCustomerQuery, useUpdateCustomerMutation } from '@/store/api';
import { CustomerEyeExamTab } from '@/components/customer-eye-exam-tab';

const statusLabels: Record<string, string> = {
  NEW: 'Mới',
  CANCELLED: 'Đã hủy',
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useCustomerQuery(params.id);
  const [formOpen, setFormOpen] = useState(false);
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const [messageApi, contextHolder] = message.useMessage();
  const save = async (values: CustomerInput): Promise<void> => {
    if (!data) return;
    try {
      await updateCustomer({ id: data.id, data: values }).unwrap();
      messageApi.success('Đã cập nhật khách hàng.');
      setFormOpen(false);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
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
      label: `Phiếu đo mắt (${data.eyeExams.length})`,
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
      {contextHolder}
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
        <Button icon={<EditOutlined />} onClick={() => setFormOpen(true)}>Chỉnh sửa</Button>
      </div>
      <Card className="surface-card">
        <Tabs items={items} />
      </Card>
      <CustomerForm
        open={formOpen}
        customer={data}
        loading={updateState.isLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
    </>
  );
}
