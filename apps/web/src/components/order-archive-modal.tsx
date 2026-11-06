'use client';

import { DeleteOutlined, InboxOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Space, Table, Tag, Tooltip, message } from 'antd';
import { useEffect, useState } from 'react';
import { getErrorMessage, orderStatusColors, orderStatusLabels, type Order, useOrdersQuery, usePermanentlyDeleteOrderMutation, useRestoreOrderMutation } from '@/store/api';

interface Props { open: boolean; customerId?: string; onClose: () => void; }

const formatDate = (value: string | null): string => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const deleteErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);
  if (message !== 'Có lỗi xảy ra. Vui lòng thử lại.') return message;
  if (error && typeof error === 'object') {
    const response = error as { status?: number | string; data?: unknown; message?: string };
    if (response.status === 404 || response.status === 405) return 'Máy chủ chưa có chức năng xóa đơn. Cần cập nhật và khởi động lại API.';
    if (typeof response.message === 'string' && response.message.includes('invalidatesTags')) return 'Giao diện chưa cập nhật kết quả. Vui lòng tải lại trang để kiểm tra đơn đã xóa.';
    if (typeof response.status === 'number') return `Yêu cầu xóa thất bại (HTTP ${response.status}).`;
  }
  return 'Chưa xác nhận được kết quả xóa. Vui lòng tải lại trang để kiểm tra.';
};

export function OrderArchiveModal({ open, customerId, onClose }: Props) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Record<string, string>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, Order['status']>>({});
  const [failedItems, setFailedItems] = useState<{ code: string; reason: string }[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [bulkRestoring, setBulkRestoring] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError, refetch } = useOrdersQuery(
    { customerId, q: debouncedQ || undefined, archiveView: 'ARCHIVED', page, pageSize },
    { skip: !open },
  );
  const [restore] = useRestoreOrderMutation();
  const [permanentlyDelete] = usePermanentlyDeleteOrderMutation();
  const busy = restoringId !== null || bulkRestoring || deletingId !== null || bulkDeleting;
  const blockedDeleteCount = selectedIds.filter((id) => selectedStatuses[id] && selectedStatuses[id] !== 'CANCELLED').length;

  useEffect(() => {
    if (!open || q.trim() === debouncedQ) return;
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [debouncedQ, open, q]);
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
    setPageSize(10);
    setSelectedIds([]);
    setSelectedCodes({});
    setSelectedStatuses({});
    setFailedItems([]);
    onClose();
  };
  const removeSelected = (idsToRemove: string[]): void => {
    const removed = new Set(idsToRemove);
    setSelectedIds((ids) => ids.filter((id) => !removed.has(id)));
    setSelectedCodes((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))));
    setSelectedStatuses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))));
  };
  const restoreOne = async (order: Order): Promise<void> => {
    if (busy) return;
    setRestoringId(order.id);
    try {
      await restore(order.id).unwrap();
      removeSelected([order.id]);
      messageApi.success(`Đã khôi phục đơn ${order.code}.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setRestoringId(null);
    }
  };
  const restoreSelected = async (): Promise<void> => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    setBulkRestoring(true);
    setFailedItems([]);
    const results: PromiseSettledResult<unknown>[] = [];
    for (let index = 0; index < ids.length; index += 5) {
      results.push(...await Promise.allSettled(ids.slice(index, index + 5).map((id) => restore(id).unwrap())));
    }
    const restored = ids.filter((_, index) => results[index].status === 'fulfilled');
    const failures = ids.flatMap((id, index) => results[index].status === 'rejected'
      ? [{ code: selectedCodes[id] ?? id, reason: getErrorMessage((results[index] as PromiseRejectedResult).reason) }]
      : []);
    removeSelected(restored);
    setFailedItems(failures);
    if (restored.length) messageApi.success(`Đã khôi phục ${restored.length} đơn hàng.`);
    if (failures.length) messageApi.warning(`${failures.length} đơn chưa được khôi phục. Xem lý do bên dưới.`);
    setBulkRestoring(false);
  };
  const confirmDeleteOne = (order: Order): void => {
    if (busy || order.status !== 'CANCELLED') return;
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: `Xóa vĩnh viễn đơn ${order.code}?`,
      content: 'Đơn đã hủy cùng sản phẩm, thanh toán và lịch sử liên quan sẽ bị xóa, không thể khôi phục.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeletingId(order.id);
        try {
          await permanentlyDelete(order.id).unwrap();
          removeSelected([order.id]);
          void refetch();
          messageApi.success(`Đã xóa vĩnh viễn đơn ${order.code}.`);
        } catch (error: unknown) {
          const reason = deleteErrorMessage(error);
          setFailedItems([{ code: order.code, reason }]);
          messageApi.error(reason);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };
  const confirmDeleteSelected = (): void => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    const codes = { ...selectedCodes };
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: `Xóa vĩnh viễn đơn đã hủy trong ${ids.length} đơn đã chọn?`,
      content: 'Chỉ đơn đã hủy và đã lưu trữ mới được xóa. Đơn đã giao hoặc đơn xóa không thành công sẽ được giữ lại và báo lý do. Dữ liệu đã xóa không thể khôi phục.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBulkDeleting(true);
        setFailedItems([]);
        try {
          const results: PromiseSettledResult<unknown>[] = [];
          for (let index = 0; index < ids.length; index += 5) {
            results.push(...await Promise.allSettled(ids.slice(index, index + 5).map(async (id) => permanentlyDelete(id).unwrap())));
          }
          const deleted = ids.filter((_, index) => results[index].status === 'fulfilled');
          const failures = ids.flatMap((id, index) => results[index].status === 'rejected'
            ? [{ code: codes[id] ?? id, reason: deleteErrorMessage((results[index] as PromiseRejectedResult).reason) }]
            : []);
          removeSelected(deleted);
          setFailedItems(failures);
          if (deleted.length) {
            void refetch();
            messageApi.success(`Đã xóa vĩnh viễn ${deleted.length} đơn hàng.`);
          }
          if (failures.length) messageApi.warning(`${failures.length} đơn chưa thể xóa. Xem lý do bên dưới.`);
        } finally {
          setBulkDeleting(false);
        }
      },
    });
  };

  return <Modal
    className="order-archive-modal"
    title={<div className="order-archive-modal__title"><span className="order-archive-modal__icon"><InboxOutlined /></span><div><small>ĐƠN LƯU TRỮ</small><strong>Đơn hàng đã lưu trữ</strong><p>Tra cứu, khôi phục hoặc xóa vĩnh viễn đơn đã hủy.</p></div></div>}
    open={open}
    onCancel={close}
    footer={<Button className="order-archive-modal__close" disabled={busy} onClick={close}>Đóng</Button>}
    width={840}
  >
    {contextHolder}
    <p className="order-archive-modal__notice"><InboxOutlined /> Đơn đã giao được giữ để tra cứu. Đơn đã hủy có thể xóa vĩnh viễn sau khi lưu trữ.</p>
    <Input className="order-archive-modal__search" allowClear prefix={<SearchOutlined />} placeholder="Tìm mã đơn, khách hàng, số điện thoại hoặc sản phẩm" aria-label="Tìm đơn hàng đã lưu trữ" value={q} disabled={busy} onChange={(event) => { setQ(event.target.value); setPage(1); setSelectedIds([]); setSelectedCodes({}); setSelectedStatuses({}); setFailedItems([]); }} />
    {selectedIds.length > 0 ? <div className="order-archive-modal__bulk">
      <div><strong>Đã chọn {selectedIds.length} đơn hàng</strong><span>{blockedDeleteCount ? `Có ${blockedDeleteCount} đơn không phải đã hủy; các đơn này sẽ được giữ lại.` : 'Có thể khôi phục hoặc xóa vĩnh viễn các đơn đã hủy.'}</span></div>
      <Space wrap size={8}>
        <Button type="link" disabled={busy} onClick={() => { setSelectedIds([]); setSelectedCodes({}); setSelectedStatuses({}); setFailedItems([]); }}>Bỏ chọn</Button>
        <Button icon={<ReloadOutlined />} loading={bulkRestoring} disabled={busy} onClick={() => void restoreSelected()}>Khôi phục đã chọn</Button>
        <Button danger icon={<DeleteOutlined />} loading={bulkDeleting} disabled={busy} onClick={confirmDeleteSelected}>Xóa vĩnh viễn đã chọn</Button>
      </Space>
    </div> : null}
    {failedItems.length > 0 ? <Alert className="order-archive-modal__failures" type="warning" showIcon message={`${failedItems.length} đơn chưa được xử lý`} description={<ul>{failedItems.map((item) => <li key={item.code}><strong>{item.code}:</strong> {item.reason}</li>)}</ul>} closable onClose={() => setFailedItems([])} /> : null}
    <Table<Order>
      className="order-archive-modal__table"
      rowKey="id"
      size="small"
      tableLayout="fixed"
      loading={isFetching}
      dataSource={data?.items}
      rowSelection={{
        selectedRowKeys: selectedIds,
        preserveSelectedRowKeys: true,
        columnWidth: 46,
        getCheckboxProps: () => ({ disabled: busy }),
        onChange: (keys, rows) => {
          if (keys.length > 100) { messageApi.warning('Chỉ có thể chọn tối đa 100 đơn mỗi lần.'); return; }
          const ids = keys.map(String);
          setSelectedIds(ids);
          setSelectedCodes((current) => {
            const next = Object.fromEntries(ids.filter((id) => id in current).map((id) => [id, current[id]]));
            rows.forEach((order) => { next[order.id] = order.code; });
            return next;
          });
          setSelectedStatuses((current) => {
            const next = Object.fromEntries(ids.filter((id) => id in current).map((id) => [id, current[id]]));
            rows.forEach((order) => { next[order.id] = order.status; });
            return next;
          });
        },
      }}
      locale={{ emptyText: isError ? <span>Không thể tải danh sách lưu trữ. <Button type="link" onClick={() => void refetch()}>Thử lại</Button></span> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn hàng được lưu trữ" /> }}
      pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: { showSearch: false }, pageSizeOptions: [10, 20, 50, 100], locale: { items_per_page: '/ trang' }, hideOnSinglePage: false, onChange: (nextPage, nextPageSize) => { if (!busy) { setPage(nextPageSize === pageSize ? nextPage : 1); setPageSize(nextPageSize); } }, showTotal: (total) => `Tổng ${total} đơn` }}
      columns={[
        { title: 'Mã đơn', dataIndex: 'code', width: 180, render: (code: string, order: Order) => <div className="order-archive-modal__identity"><strong className="order-code">{code}</strong><span>{order.customer.name}</span></div> },
        { title: 'Khách hàng', width: 195, render: (_: unknown, order: Order) => <div className="order-archive-modal__customer"><strong>{order.customer.name}</strong><span>{order.customer.phone}</span></div> },
        { title: 'Tình trạng', dataIndex: 'status', width: 105, render: (status: Order['status']) => <Tag color={orderStatusColors[status]}>{orderStatusLabels[status]}</Tag> },
        { title: 'Lưu trữ lúc', dataIndex: 'archivedAt', width: 135, render: formatDate },
        { title: 'Thao tác', width: 85, align: 'center', render: (_: unknown, order: Order) => <div className="order-archive-modal__actions"><Tooltip title="Khôi phục"><Button className="order-archive-modal__restore" type="text" icon={<ReloadOutlined />} aria-label={`Khôi phục đơn ${order.code}`} loading={restoringId === order.id} disabled={busy} onClick={() => void restoreOne(order)} /></Tooltip>{order.status === 'CANCELLED' ? <Tooltip title="Xóa vĩnh viễn"><Button danger type="text" icon={<DeleteOutlined />} aria-label={`Xóa vĩnh viễn đơn ${order.code}`} loading={deletingId === order.id} disabled={busy} onClick={() => confirmDeleteOne(order)} /></Tooltip> : null}</div> },
      ]}
    />
  </Modal>;
}
