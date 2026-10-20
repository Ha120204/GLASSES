'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Input, Modal, Space, Table, message } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatRx } from '@glasses/shared';
import { EyeExamForm } from '@/components/eye-exam-form';
import {
  getErrorMessage,
  type EyeExam,
  type EyeExamInput,
  useCreateEyeExamMutation,
  useDeleteEyeExamMutation,
  useEyeExamsQuery,
  useUpdateEyeExamMutation,
} from '@/store/api';

export default function EyeExamsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EyeExam | null>(null);
  const [messageApi, holder] = message.useMessage();
  const { data, isFetching } = useEyeExamsQuery({ q: q || undefined, page, pageSize: 10 });
  const [create, createState] = useCreateEyeExamMutation();
  const [update, updateState] = useUpdateEyeExamMutation();
  const [remove] = useDeleteEyeExamMutation();

  useEffect(() => {
    if (search.get('create') === '1') {
      setSelected(null);
      setOpen(true);
    }
  }, [search]);

  const closeForm = (): void => {
    setOpen(false);
    if (search.get('create') === '1') router.replace('/eye-exams');
  };

  const save = async (values: EyeExamInput): Promise<void> => {
    try {
      if (selected) await update({ id: selected.id, data: values }).unwrap();
      else await create(values).unwrap();
      messageApi.success('Đã lưu phiếu đo mắt.');
      closeForm();
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const del = (exam: EyeExam): void => {
    Modal.confirm({
      title: 'Xóa phiếu đo?',
      okButtonProps: { danger: true },
      onOk: async () => {
        await remove(exam.id).unwrap();
        messageApi.success('Đã xóa phiếu đo.');
      },
    });
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Đơn kính</h1>
          <p>Quản lý phiếu đo mắt và lịch tái khám.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setSelected(null); setOpen(true); }}>
          Thêm phiếu đo
        </Button>
      </div>
      {holder}
      <Card className="surface-card" styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 20 }}>
          <Input
            prefix={<SearchOutlined />}
            value={q}
            onChange={(event) => { setQ(event.target.value); setPage(1); }}
            placeholder="Tìm tên hoặc số điện thoại"
            style={{ maxWidth: 420 }}
          />
        </div>
        <Table
          rowKey="id"
          loading={isFetching}
          dataSource={data?.items}
          scroll={{ x: 900 }}
          pagination={{ current: page, total: data?.total, pageSize: 10, onChange: setPage }}
          columns={[
            { title: 'Ngày đo', dataIndex: 'examDate', render: (value: string) => new Intl.DateTimeFormat('vi-VN').format(new Date(value)) },
            { title: 'Khách hàng', render: (_: unknown, exam: EyeExam) => <>{exam.customer?.name}<br /><small>{exam.customer?.phone}</small></> },
            { title: 'OD', render: (_: unknown, exam: EyeExam) => formatRx(exam.rSph, exam.rCyl, exam.rAxis) },
            { title: 'OS', render: (_: unknown, exam: EyeExam) => formatRx(exam.lSph, exam.lCyl, exam.lAxis) },
            { title: 'Nhắc tái khám', dataIndex: 'nextReminderDate', render: (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—' },
            {
              title: '',
              render: (_: unknown, exam: EyeExam) => <Space>
                <Button type="text" icon={<PrinterOutlined />} onClick={() => router.push(`/eye-exams/${exam.id}/print`)} />
                <Button type="text" icon={<EditOutlined />} onClick={() => { setSelected(exam); setOpen(true); }} />
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => del(exam)} />
              </Space>,
            },
          ]}
        />
      </Card>
      <EyeExamForm
        open={open}
        exam={selected}
        customerId={search.get('customerId') ?? undefined}
        onClose={closeForm}
        onSubmit={save}
        loading={createState.isLoading || updateState.isLoading}
      />
    </>
  );
}
