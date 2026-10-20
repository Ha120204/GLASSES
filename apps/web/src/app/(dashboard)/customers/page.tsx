'use client';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import {
  getErrorMessage,
  type Customer,
  type CustomerInput,
  useCreateCustomerMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/store/api';

const genderLabels: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export default function CustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useCustomersQuery({
    q: q || undefined,
    page,
    pageSize: 10,
  });
  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();

  const openCreate = (): void => {
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (customer: Customer): void => {
    setSelected(customer);
    setFormOpen(true);
  };
  const save = async (values: CustomerInput): Promise<void> => {
    try {
      if (selected) await updateCustomer({ id: selected.id, data: values }).unwrap();
      else await createCustomer(values).unwrap();
      messageApi.success(selected ? 'Đã cập nhật khách hàng.' : 'Đã thêm khách hàng.');
      setFormOpen(false);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
  const remove = (customer: Customer): void => {
    Modal.confirm({
      title: 'Xóa khách hàng?',
      content: `Khách hàng “${customer.name}” sẽ bị xóa mềm và không còn xuất hiện trong danh sách.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCustomer(customer.id).unwrap();
          messageApi.success('Đã xóa khách hàng.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };
  const columns = useMemo<TableColumnsType<Customer>>(
    () => [
      {
        title: 'Khách hàng',
        dataIndex: 'name',
        render: (name: string, record) => (
          <Space>
            <Avatar style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              {name.slice(0, 1).toUpperCase()}
            </Avatar>
            <div>
              <Typography.Text strong>{name}</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {record.address || 'Chưa cập nhật địa chỉ'}
              </Typography.Text>
            </div>
          </Space>
        ),
      },
      { title: 'Số điện thoại', dataIndex: 'phone' },
      {
        title: 'Giới tính',
        dataIndex: 'gender',
        responsive: ['md'],
        render: (gender: string | null) => (gender ? <Tag>{genderLabels[gender]}</Tag> : '—'),
      },
      {
        title: 'Ngày tạo',
        dataIndex: 'createdAt',
        responsive: ['lg'],
        render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)),
      },
      {
        title: '',
        key: 'actions',
        width: 130,
        render: (_value, customer) => (
          <Space>
            <Button
              type="text"
              icon={<EyeOutlined />}
              aria-label="Xem chi tiết"
              onClick={() => router.push(`/customers/${customer.id}`)}
            />
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label="Chỉnh sửa"
              onClick={() => openEdit(customer)}
            />
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              aria-label="Xóa"
              onClick={() => remove(customer)}
            />
          </Space>
        ),
      },
    ],
    [router],
  );
  return (
    <>
      {contextHolder}
      <div className="page-heading">
        <div>
          <h1>Khách hàng</h1>
          <p>Quản lý hồ sơ, lịch sử khám mắt và mua hàng của khách.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm khách hàng
        </Button>
      </div>
      <Card className="surface-card" styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 20, borderBottom: '1px solid #f1f5f9' }}>
          <Input
            prefix={<SearchOutlined />}
            allowClear
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên hoặc số điện thoại"
            style={{ maxWidth: 460 }}
          />
        </div>
        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          locale={{
            emptyText: isError
              ? 'Không thể tải danh sách. Vui lòng thử lại.'
              : 'Chưa có khách hàng nào.',
          }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? 10,
            total: data?.total,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage),
            showTotal: (total) => `Tổng ${total} khách hàng`,
          }}
          scroll={{ x: 720 }}
        />
      </Card>
      <CustomerForm
        open={formOpen}
        customer={selected}
        loading={createState.isLoading || updateState.isLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
    </>
  );
}
