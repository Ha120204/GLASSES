'use client';

import { DeleteOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Input, Modal, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import {
  getErrorMessage,
  type Customer,
  useDeletedCustomersQuery,
  usePermanentlyDeleteCustomerMutation,
  useRestoreCustomerMutation,
} from '@/store/api';

interface CustomerTrashModalProps {
  open: boolean;
  onClose: () => void;
}

const formatDeletedAt = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';

export function CustomerTrashModal({ open, onClose }: CustomerTrashModalProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useDeletedCustomersQuery(
    { q: q || undefined, page, pageSize: 10 },
    { skip: !open },
  );
  const [restoreCustomer, restoreState] = useRestoreCustomerMutation();
  const [permanentlyDeleteCustomer, permanentlyDeleteState] = usePermanentlyDeleteCustomerMutation();

  const restore = async (customer: Customer): Promise<void> => {
    try {
      await restoreCustomer(customer.id).unwrap();
      messageApi.success(`Đã khôi phục “${customer.name}”.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const permanentlyRemove = (customer: Customer): void => {
    Modal.confirm({
      title: 'Xóa vĩnh viễn khách hàng?',
      content: `“${customer.name}” sẽ không thể khôi phục. Khách hàng đã có phiếu đo mắt hoặc đơn hàng sẽ không được phép xóa vĩnh viễn.`,
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await permanentlyDeleteCustomer(customer.id).unwrap();
          messageApi.success('Đã xóa vĩnh viễn khách hàng.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const columns = useMemo<TableColumnsType<Customer>>(
    () => [
      {
        title: 'Khách hàng',
        render: (_: unknown, customer) => (
          <div className="customer-trash-identity">
            <Avatar icon={<UserOutlined />}>{customer.name.slice(0, 1).toUpperCase()}</Avatar>
            <div>
              <strong>{customer.name}</strong>
              <span><PhoneOutlined /> {customer.phone}</span>
            </div>
          </div>
        ),
      },
      { title: 'Đã xóa lúc', dataIndex: 'deletedAt', responsive: ['sm'], render: formatDeletedAt },
      {
        title: '',
        width: 112,
        render: (_: unknown, customer) => (
          <Space size={2}>
            <Tooltip title="Khôi phục">
              <Button
                className="customer-trash-action"
                type="text"
                icon={<ReloadOutlined />}
                aria-label="Khôi phục khách hàng"
                loading={restoreState.isLoading}
                onClick={() => void restore(customer)}
              />
            </Tooltip>
            <Tooltip title="Xóa vĩnh viễn">
              <Button
                danger
                className="customer-trash-action"
                type="text"
                icon={<DeleteOutlined />}
                aria-label="Xóa vĩnh viễn khách hàng"
                loading={permanentlyDeleteState.isLoading}
                onClick={() => permanentlyRemove(customer)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [permanentlyDeleteState.isLoading, restoreState.isLoading],
  );

  return (
    <Modal
      className="customer-trash-modal"
      title={<div><span>THÙNG RÁC</span><strong>Khách hàng đã xóa</strong></div>}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={720}
    >
      {contextHolder}
      <p className="customer-trash-modal__notice">
        Khôi phục sẽ đưa khách hàng trở lại danh sách. Chỉ khách hàng chưa có phiếu đo mắt và đơn hàng mới có thể xóa vĩnh viễn.
      </p>
      <Input
        className="customer-trash-modal__search"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Tìm theo tên hoặc số điện thoại"
        value={q}
        onChange={(event) => { setQ(event.target.value); setPage(1); }}
      />
      <Table<Customer>
        className="customer-trash-table"
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isFetching}
        size="small"
        locale={{ emptyText: isError ? 'Không thể tải thùng rác. Vui lòng thử lại.' : 'Thùng rác đang trống.' }}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? 10,
          total: data?.total,
          showSizeChanger: false,
          onChange: setPage,
          showTotal: (total) => `Tổng ${total} khách hàng`,
        }}
      />
    </Modal>
  );
}
