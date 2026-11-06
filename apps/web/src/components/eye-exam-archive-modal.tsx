'use client';

import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Modal, Space, Table, Tooltip, message } from 'antd';
import { useEffect, useState } from 'react';
import { getErrorMessage, type EyeExam, useArchivedEyeExamsQuery, usePermanentlyDeleteEyeExamMutation, useRestoreEyeExamMutation } from '@/store/api';

interface Props { open: boolean; onClose: () => void; }

const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const operationError = (error: unknown): string => {
  const message = getErrorMessage(error);
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  return message === 'Có lỗi xảy ra. Vui lòng thử lại.' && typeof status === 'number' ? `Máy chủ trả về lỗi ${status}. Vui lòng thử lại.` : message;
};

async function runInBatches(ids: string[], action: (id: string) => Promise<unknown>): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let index = 0; index < ids.length; index += 5) {
    results.push(...await Promise.allSettled(ids.slice(index, index + 5).map((id) => Promise.resolve().then(() => action(id)))));
  }
  return results;
}

export function EyeExamArchiveModal({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletableById, setDeletableById] = useState<Record<string, boolean>>({});
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [failedItems, setFailedItems] = useState<{ name: string; reason: string }[]>([]);
  const [bulkPending, setBulkPending] = useState<'restore' | 'delete' | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useArchivedEyeExamsQuery({ q: debouncedQ || undefined, page, pageSize }, { skip: !open });
  const [restore, restoreState] = useRestoreEyeExamMutation();
  const [permanentlyDelete, permanentlyDeleteState] = usePermanentlyDeleteEyeExamMutation();
  const busy = restoreState.isLoading || permanentlyDeleteState.isLoading || bulkPending !== null;
  const blockedCount = selectedIds.filter((id) => !deletableById[id]).length;

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
    setDeletableById({});
    setSelectedNames({});
    setFailedItems([]);
    onClose();
  };
  const removeSelected = (idsToRemove: string[]): void => {
    const removed = new Set(idsToRemove);
    setSelectedIds((ids) => ids.filter((id) => !removed.has(id)));
    setDeletableById((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))));
    setSelectedNames((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))));
  };

  const restoreExam = async (exam: EyeExam): Promise<void> => {
    try {
      await restore(exam.id).unwrap();
      removeSelected([exam.id]);
      messageApi.success(`Đã khôi phục phiếu đo của ${exam.customer?.name ?? 'khách hàng'}.`);
    } catch (error: unknown) {
      messageApi.error(operationError(error));
    }
  };
  const confirmPermanentlyDelete = (exam: EyeExam): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: 'Xóa vĩnh viễn phiếu đo?',
      content: `Phiếu đo ngày ${new Intl.DateTimeFormat('vi-VN').format(new Date(exam.examDate))} của ${exam.customer?.name ?? 'khách hàng'} cùng lịch sử chỉnh sửa sẽ bị xóa không thể khôi phục.`,
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true, loading: permanentlyDeleteState.isLoading },
      onOk: async () => {
        try {
          await permanentlyDelete(exam.id).unwrap();
          removeSelected([exam.id]);
          messageApi.success('Đã xóa vĩnh viễn phiếu đo.');
        } catch (error: unknown) {
          messageApi.error(operationError(error));
        }
      },
    });
  };

  const restoreSelected = async (): Promise<void> => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    setBulkPending('restore');
    setFailedItems([]);
    const results = await runInBatches(ids, (id) => restore(id).unwrap());
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: operationError(result.reason) }]
      : []);
    removeSelected(ids.filter((_, index) => results[index].status === 'fulfilled'));
    setFailedItems(failures);
    const restored = ids.length - failures.length;
    if (restored) messageApi.success(`Đã khôi phục ${restored} phiếu đo.`);
    if (failures.length) messageApi.warning(`${failures.length} phiếu đo chưa được khôi phục. Xem lý do bên dưới.`);
    setBulkPending(null);
  };
  const confirmDeleteSelected = (): void => {
    if (!selectedIds.length || blockedCount || busy) return;
    const ids = [...selectedIds];
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: `Xóa vĩnh viễn ${ids.length} phiếu đo đã chọn?`,
      content: 'Các phiếu đo này và lịch sử chỉnh sửa của chúng sẽ bị xóa, không thể khôi phục. Nếu một phiếu không đủ điều kiện, phiếu đó sẽ được giữ lại và báo lý do.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        setBulkPending('delete');
        setFailedItems([]);
        const results = await runInBatches(ids, (id) => permanentlyDelete(id).unwrap());
        const failures = results.flatMap((result, index) => result.status === 'rejected'
          ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: operationError(result.reason) }]
          : []);
        removeSelected(ids.filter((_, index) => results[index].status === 'fulfilled'));
        setFailedItems(failures);
        const deleted = ids.length - failures.length;
        if (deleted) messageApi.success(`Đã xóa vĩnh viễn ${deleted} phiếu đo.`);
        if (failures.length) messageApi.warning(`${failures.length} phiếu đo chưa thể xóa. Xem lý do bên dưới.`);
        setBulkPending(null);
      },
    });
  };

  return <Modal className="eye-exam-archive" title="Phiếu đo đã lưu trữ" open={open} onCancel={close} footer={<Button disabled={busy} onClick={close}>Đóng</Button>} width={840}>
    {contextHolder}
    <p className="eye-exam-archive__notice">Chọn ô bên trái để xử lý nhiều phiếu cùng lúc. Phiếu đã dùng trong đơn hàng chỉ có thể khôi phục, không thể xóa vĩnh viễn.</p>
    <Input className="eye-exam-archive__search" allowClear prefix={<SearchOutlined />} placeholder="Tìm tên hoặc số điện thoại" aria-label="Tìm phiếu đo đã lưu trữ" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); setSelectedIds([]); setDeletableById({}); setSelectedNames({}); setFailedItems([]); }} />
    {selectedIds.length > 0 ? <div className="eye-exam-archive__bulk">
      <div><strong>Đã chọn {selectedIds.length} phiếu đo</strong>{blockedCount > 0 ? <span>{blockedCount} phiếu đã dùng trong đơn hàng. Bỏ chọn để xóa vĩnh viễn.</span> : null}</div>
      <Space wrap size={8}>
        <Button type="link" disabled={busy} onClick={() => { setSelectedIds([]); setDeletableById({}); setSelectedNames({}); setFailedItems([]); }}>Bỏ chọn</Button>
        <Button icon={<ReloadOutlined />} loading={bulkPending === 'restore'} disabled={busy} onClick={() => void restoreSelected()}>Khôi phục đã chọn</Button>
        <Tooltip title={blockedCount ? 'Bỏ chọn phiếu đã dùng trong đơn hàng trước khi xóa.' : undefined}><Button danger icon={<DeleteOutlined />} loading={bulkPending === 'delete'} disabled={busy || blockedCount > 0} onClick={confirmDeleteSelected}>Xóa vĩnh viễn đã chọn</Button></Tooltip>
      </Space>
    </div> : null}
    {failedItems.length > 0 ? <Alert className="eye-exam-archive__failures" type="warning" showIcon message={`${failedItems.length} phiếu đo chưa được xử lý`} description={<ul>{failedItems.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}:</strong> {item.reason}</li>)}</ul>} closable onClose={() => setFailedItems([])} /> : null}
    <Table<EyeExam>
      className="eye-exam-archive__table"
      rowKey="id"
      size="small"
      loading={isFetching}
      dataSource={data?.items}
      scroll={{ x: 690 }}
      rowSelection={{
        selectedRowKeys: selectedIds,
        preserveSelectedRowKeys: true,
        columnWidth: 46,
        getCheckboxProps: () => ({ disabled: busy }),
        onChange: (keys, rows) => {
          if (keys.length > 100) {
            messageApi.warning('Chỉ có thể chọn tối đa 100 phiếu đo mỗi lần.');
            return;
          }
          const ids = keys.map(String);
          setSelectedIds(ids);
          setDeletableById((current) => {
            const next = Object.fromEntries(ids.filter((id) => id in current).map((id) => [id, current[id]]));
            rows.forEach((exam) => { next[exam.id] = !exam.ordersCount; });
            return next;
          });
          setSelectedNames((current) => {
            const next = Object.fromEntries(ids.filter((id) => id in current).map((id) => [id, current[id]]));
            rows.forEach((exam) => { next[exam.id] = `${exam.customer?.name ?? 'Khách hàng'} · ${new Intl.DateTimeFormat('vi-VN').format(new Date(exam.examDate))}`; });
            return next;
          });
        },
      }}
      locale={{ emptyText: isError ? 'Không thể tải danh sách lưu trữ. Vui lòng thử lại.' : 'Chưa có phiếu đo được lưu trữ.' }}
      pagination={{ current: page, pageSize, total: data?.total, showSizeChanger: { showSearch: false }, pageSizeOptions: [10, 20, 50, 100], locale: { items_per_page: '/ trang' }, hideOnSinglePage: false, onChange: (nextPage, nextPageSize) => { if (!busy) { setPage(nextPageSize === pageSize ? nextPage : 1); setPageSize(nextPageSize); } }, showTotal: (total) => `Tổng ${total} phiếu` }}
      columns={[
        { title: 'Mã phiếu', dataIndex: 'code', width: 130 },
        { title: 'Khách hàng', width: 240, render: (_: unknown, exam: EyeExam) => <div className="eye-exam-archive__customer"><strong>{exam.customer?.name ?? 'Khách hàng đã xóa'}</strong><span>{exam.customer?.phone ?? '—'}</span></div> },
        { title: 'Ngày đo', dataIndex: 'examDate', width: 130, render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)) },
        { title: 'Lưu trữ lúc', dataIndex: 'archivedAt', width: 155, render: formatDate },
        { title: 'Đã dùng trong đơn', width: 122, align: 'center', render: (_: unknown, exam: EyeExam) => <span className={exam.ordersCount ? 'eye-exam-archive__usage eye-exam-archive__usage--linked' : 'eye-exam-archive__usage'}>{exam.ordersCount ? 'Có' : 'Chưa'}</span> },
        { title: '', width: 90, render: (_: unknown, exam: EyeExam) => <div className="eye-exam-archive__actions"><Tooltip title="Khôi phục"><Button type="text" icon={<ReloadOutlined />} aria-label={`Khôi phục phiếu đo của ${exam.customer?.name ?? 'khách hàng'}`} disabled={busy} onClick={() => void restoreExam(exam)} /></Tooltip><Tooltip title={exam.ordersCount ? 'Phiếu đã dùng trong đơn hàng nên không thể xóa vĩnh viễn.' : 'Xóa vĩnh viễn'}><Button danger type="text" icon={<DeleteOutlined />} aria-label={`Xóa vĩnh viễn phiếu đo của ${exam.customer?.name ?? 'khách hàng'}`} disabled={busy || Boolean(exam.ordersCount)} onClick={() => confirmPermanentlyDelete(exam)} /></Tooltip></div> },
      ]}
    />
  </Modal>;
}
