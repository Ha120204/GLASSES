'use client';

import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Space, Table } from 'antd';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRx } from '@glasses/shared';
import { EyeExamComparison } from './eye-exam-comparison';
import { type EyeExam, useCustomerEyeExamsQuery } from '@/store/api';

export function CustomerEyeExamTab({ customerId, exams }: { customerId: string; exams?: EyeExam[] }) {
  const router = useRouter();
  const { data: fetchedExams, isLoading, isFetching, isError, refetch } = useCustomerEyeExamsQuery(customerId, { skip: exams !== undefined });
  const data = exams ?? fetchedExams ?? [];
  const [compare, setCompare] = useState(false);
  const [first, setFirst] = useState<string>();
  const [second, setSecond] = useState<string>();
  const createExam = (): void => router.push(`/eye-exams?customerId=${customerId}&create=1`);
  const openComparison = (): void => {
    setFirst(data[1]?.id);
    setSecond(data[0]?.id);
    setCompare(true);
  };

  if (isError && !data.length) {
    return <Alert type="error" showIcon message="Không thể tải phiếu đo mắt." action={<Button size="small" loading={isFetching} onClick={() => void refetch()}>Thử lại</Button>} />;
  }

  if (!isLoading && !data.length) {
    return <Empty className="customer-eye-exams__empty" description="Chưa có phiếu đo mắt."><Button className="customer-eye-exams__create" type="primary" icon={<PlusOutlined />} onClick={createExam}>Thêm phiếu đo</Button></Empty>;
  }

  return <>
    {isError && <Alert type="error" showIcon message="Không thể cập nhật phiếu đo mắt." action={<Button size="small" loading={isFetching} onClick={() => void refetch()}>Thử lại</Button>} />}
    <Space className="customer-eye-exams__actions" size={8}>
      <Button className="customer-eye-exams__create" type="primary" icon={<PlusOutlined />} onClick={createExam}>Thêm phiếu đo</Button>
      <Button className="customer-eye-exams__compare" icon={<SwapOutlined />} onClick={openComparison} disabled={data.length < 2}>So sánh</Button>
    </Space>
    <Table<EyeExam>
      loading={isLoading}
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={data}
      columns={[
        { title: 'Mã phiếu', dataIndex: 'code' },
        { title: 'Ngày đo', dataIndex: 'examDate', render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)) },
        { title: 'OD', render: (_: unknown, exam: EyeExam) => formatRx(exam.rSph, exam.rCyl, exam.rAxis) },
        { title: 'OS', render: (_: unknown, exam: EyeExam) => formatRx(exam.lSph, exam.lCyl, exam.lAxis) },
        { title: 'PD', render: (_: unknown, exam: EyeExam) => exam.pdTotal !== null ? `Tổng ${exam.pdTotal} mm` : exam.rPd !== null && exam.lPd !== null ? `${exam.rPd} / ${exam.lPd} mm` : '—' },
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
