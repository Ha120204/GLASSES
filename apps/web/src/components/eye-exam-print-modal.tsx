'use client';

import { CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Empty, Modal, Spin } from 'antd';
import { formatAxis, formatDiopter } from '@glasses/shared';
import { type PrismBase, useEyeExamQuery } from '@/store/api';

interface EyeExamPrintModalProps {
  examId: string | null;
  onClose: () => void;
}

const formatPrism = (prism: number | null, base: PrismBase | null): string => prism === null ? '—' : `${prism.toFixed(2)}Δ${base ? ` ${base}` : ''}`;
const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value));
const wearingPurposeLabels: Record<string, string> = { DISTANCE: 'Nhìn xa', NEAR: 'Đọc gần', INTERMEDIATE: 'Máy tính / trung gian', MULTIPURPOSE: 'Đa mục đích' };
const lensDesignLabels: Record<string, string> = { SINGLE_VISION: 'Tròng đơn', BIFOCAL: 'Hai tròng', PROGRESSIVE: 'Đa tròng' };
const formatExamCode = (prefix: string | null | undefined, id: string): string => `${prefix ? `${prefix.trim().toUpperCase()}-` : ''}${id.slice(-6).toUpperCase()}`;

export function EyeExamPrintModal({ examId, onClose }: EyeExamPrintModalProps) {
  const { data: exam, isLoading, isError } = useEyeExamQuery(examId ?? '', { skip: !examId });
  const open = Boolean(examId);
  const hasAdvanced = Boolean(exam && (exam.rPrism !== null || exam.lPrism !== null || exam.rSegHeight !== null || exam.lSegHeight !== null));
  const row = (name: string, sph: number | null, cyl: number | null, axis: number | null, add: number | null, pd: number | null) => <tr><th>{name}</th><td>{formatDiopter(sph)}</td><td>{formatDiopter(cyl)}</td><td>{formatAxis(axis)}</td><td>{formatDiopter(add)}</td><td>{pd ?? '—'}</td></tr>;
  const advancedRow = (name: string, prism: number | null, base: PrismBase | null, segHeight: number | null) => <tr><th>{name}</th><td>{formatPrism(prism, base)}</td><td>{segHeight === null ? '—' : `${segHeight.toFixed(1)} mm`}</td></tr>;
  const print = (): void => {
    const clearPrintClass = (): void => document.body.classList.remove('printing-eye-exam');
    document.body.classList.add('printing-eye-exam');
    window.addEventListener('afterprint', clearPrintClass, { once: true });
    window.print();
  };

  return <Modal
    className="eye-exam-print-modal"
    open={open}
    centered
    destroyOnHidden
    width={900}
    onCancel={onClose}
    title={<div className="eye-exam-print-modal__heading"><span><PrinterOutlined /></span><div><strong>Xem trước phiếu đo</strong><p>Kiểm tra nội dung trước khi in cho khách.</p></div></div>}
    footer={<div className="eye-exam-print-modal__footer"><Button icon={<CloseOutlined />} onClick={onClose}>Đóng</Button><Button className="eye-exam-print-modal__print" type="primary" icon={<PrinterOutlined />} onClick={print}>In phiếu</Button></div>}
  >
    {isLoading ? <div className="eye-exam-print-modal__loading"><Spin size="large" /></div> : null}
    {isError ? <Empty description="Không thể tải dữ liệu phiếu in." /> : null}
    {exam ? <article className="eye-exam-print-sheet">
      <header className="eye-exam-print-sheet__store"><div><span>PHÒNG KHÁM / CỬA HÀNG</span><h1>{exam.setting?.storeName ?? 'Cửa hàng kính mắt'}</h1><p>{[exam.setting?.address, exam.setting?.phone].filter(Boolean).join(' · ') || 'Thông tin cửa hàng'}</p></div><div><span>PHIẾU ĐO MẮT</span><strong>{formatDate(exam.examDate)}</strong><em>Mã: {formatExamCode(exam.setting?.invoiceTemplate, exam.id)}</em></div></header>
      <section className="eye-exam-print-sheet__customer"><div><span>Khách hàng</span><strong>{exam.customer?.name ?? '—'}</strong></div><div><span>Số điện thoại</span><strong>{exam.customer?.phone ?? '—'}</strong></div></section>
      {exam.wearingPurpose || exam.lensDesign ? <section className="eye-exam-print-sheet__section"><h2>Thông tin lắp kính</h2><div className="eye-exam-print-sheet__recommendation">{exam.wearingPurpose ? <span>Nhu cầu sử dụng: <strong>{wearingPurposeLabels[exam.wearingPurpose] ?? exam.wearingPurpose}</strong></span> : null}{exam.lensDesign ? <span>Thiết kế tròng: <strong>{lensDesignLabels[exam.lensDesign] ?? exam.lensDesign}</strong></span> : null}</div></section> : null}
      <section className="eye-exam-print-sheet__section"><h2>Thông số khúc xạ</h2>{exam.noPrescription ? <div className="eye-exam-print-sheet__no-rx"><strong>Không kê đơn kính cho lần đo này</strong><span>{exam.noPrescriptionReason || 'Chưa ghi lý do.'}</span></div> : <><table><thead><tr><th>Mắt</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>PD đơn mắt</th></tr></thead><tbody>{row('OD (Phải)', exam.rSph, exam.rCyl, exam.rAxis, exam.rAdd, exam.rPd)}{row('OS (Trái)', exam.lSph, exam.lCyl, exam.lAxis, exam.lAdd, exam.lPd)}</tbody></table>{exam.pdTotal !== null ? <p className="eye-exam-print-sheet__pd-total">PD tổng: <strong>{exam.pdTotal} mm</strong></p> : null}</>}</section>
      {hasAdvanced ? <section className="eye-exam-print-sheet__section"><h2>Thông số lắp tròng</h2><table><thead><tr><th>Mắt</th><th>Prism / Base</th><th>Cao lắp tròng</th></tr></thead><tbody>{advancedRow('OD (Phải)', exam.rPrism, exam.rBase, exam.rSegHeight)}{advancedRow('OS (Trái)', exam.lPrism, exam.lBase, exam.lSegHeight)}</tbody></table></section> : null}
      <section className="eye-exam-print-sheet__note"><span>Ghi chú</span><p>{exam.note || 'Không có ghi chú.'}</p></section>
      <footer><span>Phiếu được tạo ngày {formatDate(exam.createdAt)}</span><span>Vui lòng giữ phiếu để đối chiếu khi cần.</span></footer>
    </article> : null}
  </Modal>;
}
