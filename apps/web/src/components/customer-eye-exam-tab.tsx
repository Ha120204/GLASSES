'use client';

import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Table } from 'antd';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRx } from '@glasses/shared';
import { EyeExamComparison } from './eye-exam-comparison';
import { type EyeExam, useCustomerEyeExamsQuery } from '@/store/api';

export function CustomerEyeExamTab({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { data = [], isLoading } = useCustomerEyeExamsQuery(customerId);
  const [compare, setCompare] = useState(false);
  const [first, setFirst] = useState<string>();
  const [second, setSecond] = useState<string>();
  const createExam = (): void => router.push(`/eye-exams?customerId=${customerId}&create=1`);

  if (!isLoading && !data.length) {
    return <Empty description="Chưa có phiếu đo mắt."><Button type="primary" icon={<PlusOutlined />} onClick={createExam}>Thêm phiếu đo</Button></Empty>;
  }

  return <>
    <Space style={{ marginBottom: 12 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={createExam}>Thêm phiếu đo</Button>
      <Button icon={<SwapOutlined />} onClick={() => setCompare(true)} disabled={data.length < 2}>So sánh</Button>
    </Space>
    <Table<EyeExam>
      loading={isLoading}
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={data}
      columns={[
        { title: 'Ngày đo', dataIndex: 'examDate', render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)) },
        { title: 'OD', render: (_: unknown, exam: EyeExam) => formatRx(exam.rSph, exam.rCyl, exam.rAxis) },
        { title: 'OS', render: (_: unknown, exam: EyeExam) => formatRx(exam.lSph, exam.lCyl, exam.lAxis) },
        { title: 'Người đo', dataIndex: 'examiner', render: (value: string | null) => value || '—' },
      ]}
    />
    <EyeExamComparison
      open={compare}
      exams={data}
      firstId={first}
      secondId={second}
      onChange={(firstId, secondId) => { setFirst(firstId); setSecond(secondId); }}
      onClose={() => setCompare(false)}
    />
  </>;
}
