'use client';

import { Modal, Select, Table, type TableColumnsType } from 'antd';
import { formatAxis, formatAxisDifference, formatDiopter, formatRxDifference } from '@glasses/shared';
import type { EyeExam } from '@/store/api';

type RxKey = keyof Pick<EyeExam,
  'rSph' | 'lSph' | 'rCyl' | 'lCyl' | 'rAxis' | 'lAxis' | 'rAdd' | 'lAdd' | 'rPd' | 'lPd'
  | 'rPrism' | 'lPrism' | 'rBase' | 'lBase' | 'rSegHeight' | 'lSegHeight'
>;
type RowKind = 'diopter' | 'axis' | 'millimeter' | 'text';

interface ComparisonRow {
  key: 'sph' | 'cyl' | 'axis' | 'add' | 'pd' | 'prism' | 'base' | 'segHeight';
  label: string;
  unit?: 'D' | 'mm' | '°' | 'Δ';
  kind: RowKind;
  right: RxKey;
  left: RxKey;
}

const rows: ComparisonRow[] = [
  { key: 'sph', label: 'SPH', unit: 'D', kind: 'diopter', right: 'rSph', left: 'lSph' },
  { key: 'cyl', label: 'CYL', unit: 'D', kind: 'diopter', right: 'rCyl', left: 'lCyl' },
  { key: 'axis', label: 'AXIS', unit: '°', kind: 'axis', right: 'rAxis', left: 'lAxis' },
  { key: 'add', label: 'ADD', unit: 'D', kind: 'diopter', right: 'rAdd', left: 'lAdd' },
  { key: 'pd', label: 'PD đơn mắt', unit: 'mm', kind: 'millimeter', right: 'rPd', left: 'lPd' },
  { key: 'prism', label: 'PRISM', unit: 'Δ', kind: 'diopter', right: 'rPrism', left: 'lPrism' },
  { key: 'base', label: 'BASE', kind: 'text', right: 'rBase', left: 'lBase' },
  { key: 'segHeight', label: 'Cao lắp', unit: 'mm', kind: 'millimeter', right: 'rSegHeight', left: 'lSegHeight' },
];

const formatDate = (value: string): string => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value));

export function EyeExamComparison({ open, exams, firstId, secondId, onChange, onClose }: { open: boolean; exams: EyeExam[]; firstId?: string; secondId?: string; onChange: (first?: string, second?: string) => void; onClose: () => void }) {
  const first = exams.find((item) => item.id === firstId);
  const second = exams.find((item) => item.id === secondId);
  const options = exams.map((item) => ({ value: item.id, label: formatDate(item.examDate) }));
  const value = (exam: EyeExam, key: RxKey) => exam[key] as number | string | null;
  const display = (exam: EyeExam, key: RxKey, row: ComparisonRow): string => {
    const current = value(exam, key);
    if (current === null) return '—';
    if (row.kind === 'text') return String(current);
    if (row.kind === 'axis') return formatAxis(current as number);
    if (row.kind === 'millimeter') return `${Number(current).toFixed(1)} mm`;
    return row.key === 'prism' ? `${formatDiopter(current as number)} Δ` : formatDiopter(current as number);
  };
  const difference = (before: number | string | null, after: number | string | null, row: ComparisonRow): string => {
    if (before === null || after === null) return before === after ? 'Không đổi' : `${before ?? '—'} → ${after ?? '—'}`;
    if (row.kind === 'text') return before === after ? 'Không đổi' : `${before} → ${after}`;
    if (row.kind === 'axis') return formatAxisDifference(before as number, after as number);
    const formatted = formatRxDifference(before as number, after as number);
    if (formatted === '—' || formatted === 'Không đổi') return formatted;
    return `${formatted} ${row.unit}`;
  };
  const hasChanged = (before: number | string | null, after: number | string | null, row: ComparisonRow): boolean => {
    if (before === after) return false;
    if (before === null || after === null) return true;
    return row.kind === 'axis' ? formatAxisDifference(before as number, after as number) !== 'Không đổi' : true;
  };
  const valueCell = (exam: EyeExam | undefined, key: RxKey, row: ComparisonRow, changed: boolean) => exam ? <strong className={changed ? 'eye-exam-comparison__changed' : undefined}>{display(exam, key, row)}</strong> : '—';
  const columns: TableColumnsType<ComparisonRow> = [
    { title: 'Thông số', dataIndex: 'label', width: 125, render: (label: string, row) => <span>{label}{row.unit ? <small className="eye-exam-comparison__unit">{row.unit}</small> : null}</span> },
    { title: `OD · ${first ? formatDate(first.examDate) : 'Phiếu 1'}`, render: (_: unknown, row) => valueCell(first, row.right, row, false) },
    { title: `OD · ${second ? formatDate(second.examDate) : 'Phiếu 2'}`, render: (_: unknown, row) => valueCell(second, row.right, row, Boolean(first && second && hasChanged(value(first, row.right), value(second, row.right), row))) },
    { title: 'Chênh OD', render: (_: unknown, row) => first && second ? difference(value(first, row.right), value(second, row.right), row) : '—' },
    { title: `OS · ${first ? formatDate(first.examDate) : 'Phiếu 1'}`, render: (_: unknown, row) => valueCell(first, row.left, row, false) },
    { title: `OS · ${second ? formatDate(second.examDate) : 'Phiếu 2'}`, render: (_: unknown, row) => valueCell(second, row.left, row, Boolean(first && second && hasChanged(value(first, row.left), value(second, row.left), row))) },
    { title: 'Chênh OS', render: (_: unknown, row) => first && second ? difference(value(first, row.left), value(second, row.left), row) : '—' },
  ];

  return <Modal className="eye-exam-comparison" title="So sánh phiếu đo" open={open} onCancel={onClose} footer={null} width={900}>
    <p className="eye-exam-comparison__hint">Mặc định là hai lần đo gần nhất. Giá trị màu cam là giá trị đã thay đổi; AXIS được tính theo chênh lệch góc ngắn nhất.</p>
    <div className="eye-exam-comparison__selectors">
      <Select aria-label="Phiếu đo thứ nhất để so sánh" placeholder="Phiếu đo trước" value={firstId} options={options.map((option) => ({ ...option, disabled: option.value === secondId }))} onChange={(id: string) => onChange(id, secondId)} />
      <Select aria-label="Phiếu đo thứ hai để so sánh" placeholder="Phiếu đo sau" value={secondId} options={options.map((option) => ({ ...option, disabled: option.value === firstId }))} onChange={(id: string) => onChange(firstId, id)} />
    </div>
    {first && second ? <Table<ComparisonRow> className="eye-exam-comparison__table" size="small" scroll={{ x: 900 }} pagination={false} rowKey="key" dataSource={rows} columns={columns} /> : null}
  </Modal>;
}
