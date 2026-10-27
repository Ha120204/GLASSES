'use client';

import { Modal, Spin, Timeline } from 'antd';
import { type EyeExam, type EyeExamAuditAction, useEyeExamHistoryQuery } from '@/store/api';

interface Props {
  exam: EyeExam | null;
  open: boolean;
  onClose: () => void;
}

const actionLabels: Record<EyeExamAuditAction, string> = {
  CREATED: 'Tạo phiếu đo',
  UPDATED: 'Cập nhật phiếu đo',
  LOCKED: 'Chốt phiếu đo',
  UNLOCKED: 'Mở chốt phiếu đo',
  ARCHIVED: 'Lưu trữ phiếu đo',
  RESTORED: 'Khôi phục phiếu đo',
};

const fieldLabels: Record<string, string> = {
  customerId: 'Khách hàng', examDate: 'Ngày đo', examiner: 'Người đo', note: 'Ghi chú',
  rSph: 'OD SPH', rCyl: 'OD CYL', rAxis: 'OD AXIS', rAdd: 'OD ADD', rPd: 'OD PD', pdTotal: 'PD tổng', rPrism: 'OD Prism', rBase: 'OD Base', rSegHeight: 'OD Cao lắp',
  lSph: 'OS SPH', lCyl: 'OS CYL', lAxis: 'OS AXIS', lAdd: 'OS ADD', lPd: 'OS PD', lPrism: 'OS Prism', lBase: 'OS Base', lSegHeight: 'OS Cao lắp',
  wearingPurpose: 'Nhu cầu sử dụng', lensDesign: 'Thiết kế tròng', noPrescription: 'Không kê đơn kính', noPrescriptionReason: 'Lý do không kê đơn',
};

const formatValue = (value: string | number | boolean | null): string => value === null || value === '' ? '—' : String(value);
const formatDateTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function EyeExamHistoryModal({ exam, open, onClose }: Props) {
  const { data, isFetching, isError } = useEyeExamHistoryQuery(exam?.id ?? '', { skip: !open || !exam });

  return <Modal
    title={<>Lịch sử phiếu đo{exam ? ` · ${new Intl.DateTimeFormat('vi-VN').format(new Date(exam.examDate))}` : ''}</>}
    open={open}
    onCancel={onClose}
    footer={null}
    width={680}
  >
    {isFetching ? <div className="eye-exam-history__loading"><Spin /></div> : null}
    {isError ? <p className="eye-exam-history__empty">Không thể tải lịch sử phiếu đo. Vui lòng thử lại.</p> : null}
    {!isFetching && !isError && !data?.length ? <p className="eye-exam-history__empty">Chưa có lịch sử cho phiếu đo này.</p> : null}
    {!isFetching && data?.length ? <Timeline items={data.map((entry) => ({
      color: entry.action === 'LOCKED' ? 'red' : entry.action === 'RESTORED' ? 'green' : 'blue',
      children: <div className="eye-exam-history__item">
        <strong>{actionLabels[entry.action]}</strong>
        <span>{formatDateTime(entry.createdAt)} · {entry.createdBy?.name ?? 'Hệ thống'}</span>
        {entry.action === 'UPDATED' && entry.changes ? <ul>{Object.entries(entry.changes).map(([field, change]) => <li key={field}><b>{fieldLabels[field] ?? field}:</b> {formatValue(change.from)} → {formatValue(change.to)}</li>)}</ul> : null}
      </div>,
    }))} /> : null}
  </Modal>;
}
