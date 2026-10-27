'use client';

import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Table, Tooltip, message } from 'antd';
import { useState } from 'react';
import { getErrorMessage, type EyeExam, useArchivedEyeExamsQuery, useRestoreEyeExamMutation } from '@/store/api';

interface Props { open: boolean; onClose: () => void; }

const formatDate = (value: string | null): string => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

export function EyeExamArchiveModal({ open, onClose }: Props) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useArchivedEyeExamsQuery({ q: q || undefined, page, pageSize: 10 }, { skip: !open });
  const [restore, restoreState] = useRestoreEyeExamMutation();

  const restoreExam = async (exam: EyeExam): Promise<void> => {
    try {
      await restore(exam.id).unwrap();
      messageApi.success(`Đã khôi phục phiếu đo của ${exam.customer?.name ?? 'khách hàng'}.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  return <Modal className="eye-exam-archive" title="Phiếu đo đã lưu trữ" open={open} onCancel={onClose} footer={<Button onClick={onClose}>Đóng</Button>} width={760}>
    {contextHolder}
    <p className="eye-exam-archive__notice">Lưu trữ không làm mất dữ liệu, lịch sử hay phiếu đo đã dùng cho đơn hàng. Khôi phục sẽ đưa phiếu trở lại danh sách đang hoạt động.</p>
    <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tên hoặc số điện thoại" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} style={{ marginBottom: 16 }} />
    <Table<EyeExam>
      rowKey="id"
      size="small"
      loading={isFetching}
      dataSource={data?.items}
      locale={{ emptyText: isError ? 'Không thể tải danh sách lưu trữ. Vui lòng thử lại.' : 'Chưa có phiếu đo được lưu trữ.' }}
      pagination={{ current: data?.page ?? page, pageSize: data?.pageSize ?? 10, total: data?.total, showSizeChanger: false, onChange: setPage, showTotal: (total) => `Tổng ${total} phiếu` }}
      columns={[
        { title: 'Khách hàng', render: (_: unknown, exam: EyeExam) => <><strong>{exam.customer?.name}</strong><br /><small>{exam.customer?.phone}</small></> },
        { title: 'Ngày đo', dataIndex: 'examDate', render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)) },
        { title: 'Lưu trữ lúc', dataIndex: 'archivedAt', render: formatDate },
        { title: '', width: 72, render: (_: unknown, exam: EyeExam) => <Tooltip title="Khôi phục"><Button type="text" icon={<ReloadOutlined />} aria-label="Khôi phục phiếu đo" loading={restoreState.isLoading} onClick={() => void restoreExam(exam)} /></Tooltip> },
      ]}
    />
  </Modal>;
}
