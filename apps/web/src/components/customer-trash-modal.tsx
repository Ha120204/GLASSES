'use client';

import { DeleteOutlined, PhoneOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Input, Modal, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
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

async function runInBatches(ids: string[], action: (id: string) => Promise<unknown>): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let index = 0; index < ids.length; index += 5) {
    results.push(...await Promise.allSettled(ids.slice(index, index + 5).map((id) => Promise.resolve().then(() => action(id)))));
  }
  return results;
}

export function CustomerTrashModal({ open, onClose }: CustomerTrashModalProps) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [failedItems, setFailedItems] = useState<{ name: string; reason: string }[]>([]);
  const [bulkPending, setBulkPending] = useState<'restore' | 'delete' | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  useEffect(() => {
    if (!open || q.trim() === debouncedQ) return;
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [debouncedQ, open, q]);
  const { data, isFetching, isError } = useDeletedCustomersQuery(
    { q: debouncedQ || undefined, page, pageSize: 10 },
    { skip: !open },
  );
  const [restoreCustomer, restoreState] = useRestoreCustomerMutation();
  const [permanentlyDeleteCustomer, permanentlyDeleteState] = usePermanentlyDeleteCustomerMutation();
  const busy = restoreState.isLoading || permanentlyDeleteState.isLoading || bulkPending !== null;

  useEffect(() => {
    if (data && page > 1 && data.total <= (page - 1) * data.pageSize) {
      setPage(Math.max(1, Math.ceil(data.total / data.pageSize)));
    }
  }, [data, page]);

  const close = (): void => {
    if (busy) return;
    setQ('');
    setDebouncedQ('');
    setPage(1);
    setSelectedIds([]);
    setSelectedNames({});
    setFailedItems([]);
    onClose();
  };

  const restore = async (customer: Customer): Promise<void> => {
    try {
      await restoreCustomer(customer.id).unwrap();
      setSelectedIds((ids) => ids.filter((id) => id !== customer.id));
      messageApi.success(`Đã khôi phục “${customer.name}”.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const permanentlyRemove = (customer: Customer): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: 'Xóa vĩnh viễn khách hàng?',
      content: `“${customer.name}” sẽ không thể khôi phục. Khách hàng đã có phiếu đo mắt hoặc đơn hàng sẽ không được phép xóa vĩnh viễn.`,
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await permanentlyDeleteCustomer(customer.id).unwrap();
          setSelectedIds((ids) => ids.filter((id) => id !== customer.id));
          messageApi.success('Đã xóa vĩnh viễn khách hàng.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };

  const restoreSelected = async (): Promise<void> => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    setBulkPending('restore');
    setFailedItems([]);
    const results = await runInBatches(ids, (id) => restoreCustomer(id).unwrap());
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: getErrorMessage(result.reason) }]
      : []);
    setSelectedIds(ids.filter((_, index) => results[index].status === 'rejected'));
    setFailedItems(failures);
    const restored = ids.length - failures.length;
    if (restored) messageApi.success(`Đã khôi phục ${restored} khách hàng.`);
    if (failures.length) messageApi.warning(`${failures.length} khách hàng chưa được khôi phục. Xem lý do bên dưới.`);
    setBulkPending(null);
  };

  const permanentlyRemoveSelected = (): void => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: `Xóa vĩnh viễn ${ids.length} khách hàng đã chọn?`,
      content: 'Thao tác này không thể khôi phục. Khách hàng có phiếu đo mắt hoặc đơn hàng sẽ được giữ lại trong thùng rác.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBulkPending('delete');
        setFailedItems([]);
        const results = await runInBatches(ids, (id) => permanentlyDeleteCustomer(id).unwrap());
        const failures = results.flatMap((result, index) => result.status === 'rejected'
          ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: getErrorMessage(result.reason) }]
          : []);
        setSelectedIds(ids.filter((_, index) => results[index].status === 'rejected'));
        setFailedItems(failures);
        const deleted = ids.length - failures.length;
        if (deleted) messageApi.success(`Đã xóa vĩnh viễn ${deleted} khách hàng.`);
        if (failures.length) messageApi.warning(`${failures.length} khách hàng không thể xóa vĩnh viễn. Xem lý do bên dưới.`);
        setBulkPending(null);
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
                disabled={busy}
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
                disabled={busy}
                onClick={() => permanentlyRemove(customer)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [busy],
  );

  return (
    <Modal
      className="customer-trash-modal"
      title={<div><span>THÙNG RÁC</span><strong>Khách hàng đã xóa</strong></div>}
      open={open}
      onCancel={close}
      footer={<Button onClick={close}>Đóng</Button>}
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
        onChange={(event) => { setQ(event.target.value); setSelectedIds([]); setSelectedNames({}); setFailedItems([]); }}
      />
      {selectedIds.length > 0 && <div className="customer-trash-modal__bulk-actions">
        <strong>Đã chọn {selectedIds.length} khách hàng</strong>
        <Space wrap size={8}>
          <Button type="link" disabled={busy} onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
          <Button icon={<ReloadOutlined />} loading={bulkPending === 'restore'} disabled={busy} onClick={() => void restoreSelected()}>Khôi phục đã chọn</Button>
          <Button danger icon={<DeleteOutlined />} loading={bulkPending === 'delete'} disabled={busy} onClick={permanentlyRemoveSelected}>Xóa vĩnh viễn đã chọn</Button>
        </Space>
      </div>}
      {failedItems.length > 0 && <Alert className="customer-trash-modal__blocked" type="warning" showIcon message={`${failedItems.length} khách hàng chưa được xử lý`} description={<ul>{failedItems.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}:</strong> {item.reason}</li>)}</ul>} closable onClose={() => setFailedItems([])} />}
      <Table<Customer>
        className="customer-trash-table"
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedIds,
          preserveSelectedRowKeys: true,
          getCheckboxProps: () => ({ disabled: busy }),
          onChange: (keys, rows) => {
            if (keys.length > 100) {
              messageApi.warning('Chỉ có thể chọn tối đa 100 khách hàng mỗi lần.');
              return;
            }
            setSelectedIds(keys.map(String));
            setSelectedNames((names) => ({ ...names, ...Object.fromEntries(rows.map((row) => [row.id, row.name])) }));
          },
        }}
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
