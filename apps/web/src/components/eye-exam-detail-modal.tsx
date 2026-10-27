'use client';

import { CalendarOutlined, EditOutlined, FileTextOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { Avatar, Button, Empty, Modal, Spin, Tag } from 'antd';
import { formatRx } from '@glasses/shared';
import { type EyeExam, useEyeExamQuery } from '@/store/api';

interface EyeExamDetailModalProps {
  examId: string | null;
  onClose: () => void;
  onEdit: (exam: EyeExam) => void;
  onFinalize: (exam: EyeExam) => Promise<void>;
  finalizing: boolean;
}

const formatDate = (value: string | null): string => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value))
  : 'Chưa đặt lịch';
const formatValue = (value: number | null, suffix = ''): string => value === null ? '—' : `${value > 0 ? '+' : ''}${value}${suffix}`;
const wearingPurposeLabels: Record<string, string> = { DISTANCE: 'Nhìn xa', NEAR: 'Đọc gần', INTERMEDIATE: 'Máy tính / trung gian', MULTIPURPOSE: 'Đa mục đích' };
const lensDesignLabels: Record<string, string> = { SINGLE_VISION: 'Tròng đơn', BIFOCAL: 'Hai tròng', PROGRESSIVE: 'Đa tròng' };

function PrescriptionTable({ exam }: { exam: EyeExam }) {
  const rows = [
    { label: 'OD', name: 'Mắt phải', sph: exam.rSph, cyl: exam.rCyl, axis: exam.rAxis, add: exam.rAdd, pd: exam.rPd },
    { label: 'OS', name: 'Mắt trái', sph: exam.lSph, cyl: exam.lCyl, axis: exam.lAxis, add: exam.lAdd, pd: exam.lPd },
  ];
  return <div className="eye-exam-detail__rx-wrap"><table className="eye-exam-detail__rx"><thead><tr><th>Mắt</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>PD đơn mắt</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row"><strong>{row.label}</strong><span>{row.name}</span></th><td>{formatValue(row.sph, ' D')}</td><td>{formatValue(row.cyl, ' D')}</td><td>{formatValue(row.axis, '°')}</td><td>{formatValue(row.add, ' D')}</td><td>{formatValue(row.pd, ' mm')}</td></tr>)}</tbody></table></div>;
}

export function EyeExamDetailModal({ examId, onClose, onEdit, onFinalize, finalizing }: EyeExamDetailModalProps) {
  const { data: exam, isLoading, isError } = useEyeExamQuery(examId ?? '', { skip: !examId });
  const open = Boolean(examId);
  const hasAdvanced = Boolean(exam && (exam.rPrism !== null || exam.lPrism !== null || exam.rSegHeight !== null || exam.lSegHeight !== null));

  return <Modal
    className="eye-exam-detail-modal"
    open={open}
    centered
    destroyOnHidden
    width={850}
    onCancel={onClose}
    footer={exam ? <div className="eye-exam-detail__footer"><Button onClick={onClose}>Đóng</Button>{!exam.lockedAt ? <><Button icon={<EditOutlined />} onClick={() => onEdit(exam)}>Chỉnh sửa phiếu</Button><Button className="eye-exam-detail__finalize" type="primary" icon={<LockOutlined />} loading={finalizing} onClick={() => void onFinalize(exam)}>Chốt phiếu</Button></> : null}</div> : null}
    title={exam ? <div className="eye-exam-detail__heading"><Avatar>{exam.customer?.name.slice(0, 1).toUpperCase() ?? '?'}</Avatar><div><span>PHIẾU ĐO MẮT</span><strong>{exam.customer?.name ?? 'Khách hàng'}</strong><em><PhoneOutlined /> {exam.customer?.phone ?? 'Chưa có số điện thoại'}</em></div></div> : 'Phiếu đo mắt'}
  >
    {isLoading ? <div className="eye-exam-detail__loading"><Spin size="large" /></div> : null}
    {isError ? <Empty description="Không thể tải phiếu đo mắt." /> : null}
    {exam ? <>
      <div className="eye-exam-detail__summary">
        <div><span><CalendarOutlined /> Ngày đo</span><strong>{formatDate(exam.examDate)}</strong></div>
        <div><span>Loại phiếu</span><strong>{exam.noPrescription ? 'Không kê đơn kính' : 'Có kê đơn kính'}</strong></div>
        <Tag color={exam.lockedAt ? 'red' : 'blue'}>{exam.lockedAt ? 'Đã chốt' : 'Bản nháp'}</Tag>
      </div>
      {exam.wearingPurpose || exam.lensDesign ? <section className="eye-exam-detail__section eye-exam-detail__section--recommendation"><div className="eye-exam-detail__section-heading"><span><FileTextOutlined /></span><div><strong>Thông tin lắp kính</strong><em>Nhu cầu sử dụng và thiết kế tròng đã tư vấn.</em></div></div><div className="eye-exam-detail__advanced-grid">{exam.wearingPurpose ? <div><span>Nhu cầu sử dụng</span><strong>{wearingPurposeLabels[exam.wearingPurpose] ?? exam.wearingPurpose}</strong></div> : null}{exam.lensDesign ? <div><span>Thiết kế tròng</span><strong>{lensDesignLabels[exam.lensDesign] ?? exam.lensDesign}</strong></div> : null}</div></section> : null}
      <section className="eye-exam-detail__section">
        <div className="eye-exam-detail__section-heading"><span><FileTextOutlined /></span><div><strong>Thông số khúc xạ</strong><em>OD: {formatRx(exam.rSph, exam.rCyl, exam.rAxis)} · OS: {formatRx(exam.lSph, exam.lCyl, exam.lAxis)}</em></div></div>
        {exam.noPrescription ? <div className="eye-exam-detail__no-rx"><strong>Không kê đơn kính cho lần đo này</strong><span>{exam.noPrescriptionReason || 'Chưa ghi lý do.'}</span></div> : <><PrescriptionTable exam={exam} />{exam.pdTotal !== null ? <p className="eye-exam-detail__pd-total">PD tổng: <strong>{exam.pdTotal} mm</strong></p> : null}</>}
      </section>
      {hasAdvanced ? <section className="eye-exam-detail__section eye-exam-detail__section--advanced"><div className="eye-exam-detail__section-heading"><span><FileTextOutlined /></span><div><strong>Thông số lắp tròng nâng cao</strong><em>Prism, hướng đáy và chiều cao lắp tròng.</em></div></div><div className="eye-exam-detail__advanced-grid"><div><span>Mắt phải · OD</span><strong>Prism {formatValue(exam.rPrism, ' Δ')} {exam.rBase ?? '—'} · Cao lắp {formatValue(exam.rSegHeight, ' mm')}</strong></div><div><span>Mắt trái · OS</span><strong>Prism {formatValue(exam.lPrism, ' Δ')} {exam.lBase ?? '—'} · Cao lắp {formatValue(exam.lSegHeight, ' mm')}</strong></div></div></section> : null}
      {exam.note ? <section className="eye-exam-detail__note"><span>Ghi chú</span><p>{exam.note}</p></section> : null}
    </> : null}
  </Modal>;
}
