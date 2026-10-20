'use client';

import { Modal, Select, Table, type TableColumnsType } from 'antd';
import { formatAxis, formatDiopter, formatRxDifference } from '@glasses/shared';
import type { EyeExam } from '@/store/api';

type RxKey = 'rSph' | 'lSph' | 'rCyl' | 'lCyl' | 'rAxis' | 'lAxis' | 'rAdd' | 'lAdd' | 'rPd' | 'lPd';
interface ComparisonRow { key: string; label: string; right: RxKey; left: RxKey; }
const rows: ComparisonRow[] = [
  { key: 'sph', label: 'SPH', right: 'rSph', left: 'lSph' }, { key: 'cyl', label: 'CYL', right: 'rCyl', left: 'lCyl' }, { key: 'axis', label: 'AXIS', right: 'rAxis', left: 'lAxis' }, { key: 'add', label: 'ADD', right: 'rAdd', left: 'lAdd' }, { key: 'pd', label: 'PD', right: 'rPd', left: 'lPd' },
];

export function EyeExamComparison({ open, exams, firstId, secondId, onChange, onClose }: { open: boolean; exams: EyeExam[]; firstId?: string; secondId?: string; onChange: (first?: string, second?: string) => void; onClose: () => void }) {
  const first = exams.find((item) => item.id === firstId); const second = exams.find((item) => item.id === secondId);
  const options = exams.map((item) => ({ value: item.id, label: new Intl.DateTimeFormat('vi-VN').format(new Date(item.examDate)) }));
  const display = (exam: EyeExam, key: RxKey): string => key.endsWith('Axis') ? formatAxis(exam[key]) : formatDiopter(exam[key]);
  const columns: TableColumnsType<ComparisonRow> = [
    { title: 'Thông số', dataIndex: 'label' }, { title: 'OD — Lần 1', render: (_: unknown, row) => first ? display(first, row.right) : '—' }, { title: 'OD — Lần 2', render: (_: unknown, row) => second && first ? <b style={{ color: first[row.right] !== second[row.right] ? '#d97706' : undefined }}>{display(second, row.right)}</b> : '—' }, { title: 'Chênh OD', render: (_: unknown, row) => first && second ? formatRxDifference(first[row.right], second[row.right]) : '—' }, { title: 'OS — Lần 1', render: (_: unknown, row) => first ? display(first, row.left) : '—' }, { title: 'OS — Lần 2', render: (_: unknown, row) => second && first ? <b style={{ color: first[row.left] !== second[row.left] ? '#d97706' : undefined }}>{display(second, row.left)}</b> : '—' }, { title: 'Chênh OS', render: (_: unknown, row) => first && second ? formatRxDifference(first[row.left], second[row.left]) : '—' },
  ];
  return <Modal title="So sánh phiếu đo" open={open} onCancel={onClose} footer={null} width={760}><Select placeholder="Lần đo thứ nhất" value={firstId} options={options} onChange={(id: string) => onChange(id, secondId)} style={{ width: '48%', marginRight: '4%' }} /><Select placeholder="Lần đo thứ hai" value={secondId} options={options} onChange={(id: string) => onChange(firstId, id)} style={{ width: '48%' }} />{first && second && <Table<ComparisonRow> style={{ marginTop: 20 }} pagination={false} rowKey="key" dataSource={rows} columns={columns} />}</Modal>;
}
