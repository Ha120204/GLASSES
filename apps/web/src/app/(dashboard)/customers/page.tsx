'use client';

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  IdcardOutlined,
  PhoneOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Input,
  Modal,
  Space,
  Table,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { CustomerForm } from '@/components/customer-form';
import { CustomerImportModal } from '@/components/customer-import-modal';
import { CustomerProfileModal } from '@/components/customer-profile-modal';
import { CustomerTrashModal } from '@/components/customer-trash-modal';
import {
  getErrorMessage,
  type Customer,
  type CustomerInput,
  useCreateCustomerMutation,
  useBulkDeleteCustomersMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/store/api';

const genderLabels: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useCustomersQuery({
    q: q || undefined,
    page,
    pageSize,
  });
  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const [bulkDeleteCustomers, bulkDeleteState] = useBulkDeleteCustomersMutation();

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
  const exportCustomers = (ids?: string[]): void => {
    const selected = ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
    window.location.assign(`/api/customers/export${selected}`);
  };
  const removeSelected = (): void => {
    Modal.confirm({
      title: `Chuyển ${selectedIds.length} khách hàng vào Thùng rác?`,
      content: 'Các hồ sơ đã chọn sẽ bị xóa mềm và có thể khôi phục trong Thùng rác.',
      okText: 'Chuyển vào Thùng rác', cancelText: 'Hủy', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await bulkDeleteCustomers(selectedIds).unwrap();
          setSelectedIds([]);
          messageApi.success(`Đã chuyển ${result.count} khách hàng vào Thùng rác.`);
        } catch (error: unknown) { messageApi.error(getErrorMessage(error)); }
      },
    });
  };
  const columns = useMemo<TableColumnsType<Customer>>(
    () => [
      {
        title: 'STT', key: 'index', width: 66,
        render: (_value: unknown, _customer: Customer, index: number) => <span className="customer-index">{(page - 1) * pageSize + index + 1}</span>,
      },
      {
        title: 'Khách hàng',
        dataIndex: 'name',
        width: 360,
        render: (name: string, record) => <div className="customer-identity">
          <Avatar>{name.slice(0, 1).toUpperCase()}</Avatar>
          <div>
            <strong>{name}</strong>
            <span>{record.address || 'Chưa cập nhật địa chỉ'}</span>
          </div>
        </div>,
      },
      {
        title: 'Liên hệ',
        dataIndex: 'phone',
        width: 270,
        render: (phone: string) => <div className="customer-contact"><span className="customer-phone"><PhoneOutlined /> {phone}</span><span>Liên hệ chính</span></div>,
      },
      {
        title: 'Thông tin',
        dataIndex: 'gender',
        responsive: ['md'],
        render: (gender: string | null) => <div className="customer-meta"><span className={gender ? 'customer-gender' : 'customer-muted'}>{gender ? genderLabels[gender] : 'Chưa cập nhật giới tính'}</span><span><IdcardOutlined /> Hồ sơ khách hàng</span></div>,
      },
      {
        title: 'Ngày tạo hồ sơ',
        dataIndex: 'createdAt',
        responsive: ['lg'],
        render: (value: string) => <span className="customer-created">{new Intl.DateTimeFormat('vi-VN').format(new Date(value))}</span>,
      },
      {
        title: '',
        key: 'actions',
        width: 116,
        render: (_value, customer) => <Space size={2}>
          <Tooltip title="Xem hồ sơ"><Button type="text" className="customer-action" icon={<EyeOutlined />} aria-label="Xem hồ sơ" onClick={(event) => { event.stopPropagation(); setProfileId(customer.id); }} /></Tooltip>
          <Tooltip title="Chỉnh sửa"><Button type="text" className="customer-action" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={(event) => { event.stopPropagation(); openEdit(customer); }} /></Tooltip>
          <Tooltip title="Xóa"><Button danger type="text" className="customer-action" icon={<DeleteOutlined />} aria-label="Xóa" onClick={(event) => { event.stopPropagation(); remove(customer); }} /></Tooltip>
        </Space>,
      },
    ],
    [page, pageSize],
  );
  return (
    <div className="customers-page">
      {contextHolder}
      <header className="customers-page__hero">
        <div>
          <span className="customers-page__eyebrow">KHÁCH HÀNG</span>
          <h1>Khách hàng</h1>
          <p>Quản lý hồ sơ, lịch sử khám mắt và mua hàng của khách.</p>
        </div>
        <Space wrap>
          <Button className="customers-page__trash" icon={<DeleteOutlined />} onClick={() => setTrashOpen(true)}>
            Thùng rác
          </Button>
          <Button className="customers-page__excel" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Nhập Excel
          </Button>
          <Button className="customers-page__excel" icon={<DownloadOutlined />} onClick={() => exportCustomers()}>
            Xuất Excel
          </Button>
          <Button className="customers-page__create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm khách hàng
          </Button>
        </Space>
      </header>
      <Card className="customers-workspace" styles={{ body: { padding: 0 } }}>
        <div className="customers-toolbar">
          <div className="customers-toolbar__intro">
            <span className="customers-toolbar__icon"><TeamOutlined /></span>
          <div><strong>Danh sách khách hàng</strong><span>Tra cứu, mở hồ sơ và cập nhật thông tin nhanh.</span></div>
          </div>
          <Input
            className="customers-search"
            prefix={<SearchOutlined />}
            allowClear
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
              setSelectedIds([]);
            }}
          placeholder="Tìm theo tên hoặc số điện thoại…"
          />
        <span className="customers-toolbar__summary"><b>{data?.total ?? 0}</b><span> khách hàng</span></span>
        </div>
        {selectedIds.length > 0 && <div className="customers-bulk-actions">
          <strong>Đã chọn {selectedIds.length} khách hàng</strong>
          <Space wrap size={8}>
            <Button type="link" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportCustomers(selectedIds)}>Xuất Excel đã chọn</Button>
            <Button danger icon={<DeleteOutlined />} loading={bulkDeleteState.isLoading} onClick={removeSelected}>Chuyển vào Thùng rác</Button>
          </Space>
        </div>}
        <Table<Customer>
          className="customers-table"
          rowKey="id"
          columns={columns}
          dataSource={data?.items}
          loading={isFetching}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys.map(String)),
            columnWidth: 48,
          }}
          onRow={(customer) => ({ onClick: () => setProfileId(customer.id) })}
          locale={{
            emptyText: isError
              ? 'Không thể tải danh sách. Vui lòng thử lại.'
              : 'Chưa có khách hàng nào. Hãy thêm khách hàng đầu tiên.',
          }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            locale: { items_per_page: '/ trang' },
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPageSize === pageSize ? nextPage : 1);
              setPageSize(nextPageSize);
              setSelectedIds([]);
            },
          }}
          scroll={{ x: 900 }}
        />
      </Card>
      <CustomerForm
        open={formOpen}
        customer={selected}
        loading={createState.isLoading || updateState.isLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
      <CustomerProfileModal
        customerId={profileId}
        onClose={() => setProfileId(null)}
        onEdit={(customer) => { setProfileId(null); openEdit(customer); }}
      />
      <CustomerTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
      <CustomerImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
