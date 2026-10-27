'use client';

import { CalendarOutlined, DownloadOutlined, EditOutlined, EyeOutlined, HistoryOutlined, InboxOutlined, MoreOutlined, PlusOutlined, PrinterOutlined, SearchOutlined, UnlockOutlined, UploadOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, DatePicker, Dropdown, Input, Modal, Select, Space, Table, message, type MenuProps } from 'antd';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatRx } from '@glasses/shared';
import { EyeExamArchiveModal } from '@/components/eye-exam-archive-modal';
import { EyeExamDetailModal } from '@/components/eye-exam-detail-modal';
import { EyeExamForm } from '@/components/eye-exam-form';
import { EyeExamHistoryModal } from '@/components/eye-exam-history-modal';
import { EyeExamImportModal } from '@/components/eye-exam-import-modal';
import { EyeExamPrintModal } from '@/components/eye-exam-print-modal';
import {
  getErrorMessage,
  type EyeExam,
  type EyeExamInput,
  type EyeExamStatusFilter,
  useArchiveEyeExamMutation,
  useBulkArchiveEyeExamsMutation,
  useCreateEyeExamMutation,
  useCustomersQuery,
  useEyeExamsQuery,
  useFinalizeExistingEyeExamMutation,
  useFinalizeEyeExamMutation,
  useLockEyeExamMutation,
  useUnlockEyeExamMutation,
  useUpdateEyeExamMutation,
} from '@/store/api';

export default function EyeExamsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [q, setQ] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();
  const [status, setStatus] = useState<EyeExamStatusFilter | undefined>();
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerQuery, setCustomerQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<EyeExam | null>(null);
  const [detailExamId, setDetailExamId] = useState<string | null>(null);
  const [printExamId, setPrintExamId] = useState<string | null>(null);
  const [historyExam, setHistoryExam] = useState<EyeExam | null>(null);
  const [messageApi, holder] = message.useMessage();
  const { data, isFetching, isError } = useEyeExamsQuery({ q: q || undefined, customerId, dateFrom: dateRange?.[0], dateTo: dateRange?.[1], status, page, pageSize });
  const { data: customers, isFetching: isFetchingCustomers } = useCustomersQuery({ q: customerQuery || undefined, page: 1, pageSize: 20 });
  const [create, createState] = useCreateEyeExamMutation();
  const [finalize, finalizeState] = useFinalizeEyeExamMutation();
  const [update, updateState] = useUpdateEyeExamMutation();
  const [finalizeExisting, finalizeExistingState] = useFinalizeExistingEyeExamMutation();
  const [lock, lockState] = useLockEyeExamMutation();
  const [unlock] = useUnlockEyeExamMutation();
  const [archive] = useArchiveEyeExamMutation();
  const [bulkArchive, bulkArchiveState] = useBulkArchiveEyeExamsMutation();

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

  const resetFilters = (): void => {
    setQ('');
    setDateRange(undefined);
    setStatus(undefined);
    setCustomerId(undefined);
    setCustomerQuery('');
    setPage(1);
    setSelectedIds([]);
  };

  const hasFilters = Boolean(q || dateRange || status || customerId);
  const exportExams = (ids?: string[]): void => { const params = new URLSearchParams(); if (ids?.length) params.set('ids', ids.join(',')); else { if (q) params.set('q', q); if (customerId) params.set('customerId', customerId); if (dateRange?.[0]) params.set('dateFrom', dateRange[0]); if (dateRange?.[1]) params.set('dateTo', dateRange[1]); if (status) params.set('status', status); } window.location.assign(`/api/eye-exams/export${params.size ? `?${params.toString()}` : ''}`); };

  const save = async (values: EyeExamInput, intent: 'draft' | 'finalize'): Promise<void> => {
    try {
      if (selected) {
        if (intent === 'finalize') await finalizeExisting({ id: selected.id, data: values }).unwrap();
        else await update({ id: selected.id, data: values }).unwrap();
      } else if (intent === 'finalize') await finalize(values).unwrap();
      else await create(values).unwrap();
      messageApi.success(intent === 'finalize' ? 'Đã chốt phiếu đo.' : 'Đã lưu bản nháp.');
      closeForm();
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const unlockExam = (exam: EyeExam): void => {
    Modal.confirm({
      className: 'eye-exam-confirm',
      icon: null,
      title: 'Mở chốt phiếu?',
      content: 'Phiếu sẽ trở lại bản nháp và có thể được chỉnh sửa. Thao tác này được ghi vào lịch sử.',
      okText: 'Mở chốt',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await unlock(exam.id).unwrap();
          messageApi.success('Đã mở chốt phiếu đo.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };

  const finalizeDraft = async (exam: EyeExam): Promise<void> => {
    try {
      await lock(exam.id).unwrap();
      messageApi.success('Đã chốt phiếu đo.');
      setDetailExamId(null);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const archiveExam = (exam: EyeExam): void => {
    Modal.confirm({
      className: 'eye-exam-confirm',
      icon: null,
      title: 'Lưu trữ phiếu đo?',
      content: 'Phiếu sẽ không còn trong danh sách đang hoạt động nhưng dữ liệu, lịch sử và các đơn hàng liên quan vẫn được giữ nguyên.',
      okText: 'Lưu trữ',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await archive(exam.id).unwrap();
          messageApi.success('Đã lưu trữ phiếu đo. Bạn có thể khôi phục trong mục Phiếu lưu trữ.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };

  const archiveSelected = (): void => {
    Modal.confirm({
      className: 'eye-exam-confirm',
      icon: null,
      title: `Lưu trữ ${selectedIds.length} phiếu đo?`,
      content: 'Các phiếu đã chọn sẽ được chuyển sang mục Phiếu lưu trữ và vẫn có thể khôi phục sau này.',
      okText: 'Lưu trữ', cancelText: 'Hủy', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await bulkArchive(selectedIds).unwrap();
          setSelectedIds([]);
          messageApi.success(`Đã lưu trữ ${result.count} phiếu đo.`);
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };
  const runMenuAction = (exam: EyeExam, key: string): void => {
    // Let Dropdown finish closing before another Ant Design overlay is mounted.
    window.setTimeout(() => {
      if (key === 'print') {
        setDetailExamId(null);
        setPrintExamId(exam.id);
      } else if (key === 'history') setHistoryExam(exam);
      else if (key === 'unlock') unlockExam(exam);
      else if (key === 'edit') {
        setSelected(exam);
        setOpen(true);
      } else if (key === 'archive') archiveExam(exam);
    }, 0);
  };

  return <div className="eye-exams-page">
    <header className="eye-exams-page__hero">
      <div>
        <span className="eye-exams-page__eyebrow">CHUYÊN MÔN</span>
        <h1>Phiếu đo mắt</h1>
        <p>Quản lý phiếu đo mắt và trạng thái chốt phiếu.</p>
      </div>
      <Space wrap>
        <Button className="eye-exams-page__archive" icon={<InboxOutlined />} onClick={() => setArchiveOpen(true)}>Phiếu lưu trữ</Button>
        <Button className="eye-exams-page__archive" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập Excel</Button>
        <Button className="eye-exams-page__archive" icon={<DownloadOutlined />} onClick={() => exportExams()}>Xuất Excel</Button>
        <Button className="eye-exams-page__create" type="primary" icon={<PlusOutlined />} onClick={() => { setSelected(null); setOpen(true); }}>Thêm phiếu đo</Button>
      </Space>
    </header>
    {holder}
    <Card className="eye-exams-workspace" styles={{ body: { padding: 0 } }}>
      <div className="eye-exams-toolbar">
        <div className="eye-exams-toolbar__intro">
          <span className="eye-exams-toolbar__icon"><CalendarOutlined /></span>
          <div><strong>Danh sách phiếu đo</strong><span>Theo dõi các phiếu đo của khách hàng.</span></div>
        </div>
        <div className="eye-exams-toolbar__filters">
          <Input className="eye-exams-search" prefix={<SearchOutlined />} allowClear value={q} onChange={(event) => { setQ(event.target.value); setPage(1); setSelectedIds([]); }} placeholder="Tìm tên hoặc số điện thoại" />
          <DatePicker.RangePicker
            className="eye-exams-date-filter"
            value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(values) => { const [from, to] = values ?? []; setDateRange(from && to ? [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')] : undefined); setPage(1); setSelectedIds([]); }}
          />
          <Select<EyeExamStatusFilter>
            className="eye-exams-status-filter"
            allowClear
            placeholder="Trạng thái"
            value={status}
            options={[{ value: 'DRAFT', label: 'Bản nháp' }, { value: 'LOCKED', label: 'Đã chốt' }]}
            onChange={(value) => { setStatus(value); setPage(1); setSelectedIds([]); }}
          />
          <Select
            className="eye-exams-customer-filter"
            allowClear
            showSearch
            filterOption={false}
            popupMatchSelectWidth={300}
            loading={isFetchingCustomers}
            placeholder="Khách hàng"
            value={customerId}
            onSearch={setCustomerQuery}
            options={(customers?.items ?? []).map((customer) => ({
              value: customer.id,
              label: <span className="eye-exams-customer-option"><strong>{customer.name}</strong><span>{customer.phone}</span></span>,
            }))}
            onChange={(value) => { setCustomerId(value); setPage(1); setSelectedIds([]); }}
          />
          {hasFilters ? <Button className="eye-exams-clear-filters" type="link" onClick={resetFilters}>Xóa lọc</Button> : null}
        </div>
        <span className="eye-exams-toolbar__summary">Có <b>{data?.total ?? 0}</b> phiếu đang hoạt động</span>
      </div>
      {selectedIds.length > 0 && <div className="eye-exams-bulk-actions">
        <strong>Đã chọn {selectedIds.length} phiếu đo</strong>
        <Space wrap size={8}>
          <Button type="link" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
          <Button type="link" icon={<DownloadOutlined />} onClick={() => exportExams(selectedIds)}>Xuất Excel</Button>
          <Button danger icon={<InboxOutlined />} loading={bulkArchiveState.isLoading} onClick={archiveSelected}>Lưu trữ đã chọn</Button>
        </Space>
      </div>}
      <Table<EyeExam>
        className="eye-exams-table"
        rowKey="id"
        loading={isFetching}
        dataSource={data?.items}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(String)), columnWidth: 48 }}
        onRow={(exam) => ({ onClick: () => setDetailExamId(exam.id) })}
        scroll={{ x: 1140 }}
        locale={{ emptyText: isError ? 'Không thể tải danh sách phiếu đo. Vui lòng thử lại.' : 'Chưa có phiếu đo mắt nào.' }}
        pagination={{
          current: data?.page ?? page, total: data?.total, pageSize: data?.pageSize ?? pageSize,
          showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], locale: { items_per_page: '/ trang' },
          onChange: (nextPage, nextPageSize) => { setPage(nextPageSize === pageSize ? nextPage : 1); setPageSize(nextPageSize); setSelectedIds([]); },
        }}
        columns={[
          { title: 'STT', key: 'index', width: 66, render: (_: unknown, _exam: EyeExam, index: number) => <span className="eye-exam-index">{(page - 1) * pageSize + index + 1}</span> },
          { title: 'Ngày đo', dataIndex: 'examDate', width: 142, render: (value: string) => <div className="eye-exam-date"><strong>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))}</strong><span>Phiếu đo khúc xạ</span></div> },
          { title: 'Khách hàng', width: 250, render: (_: unknown, exam: EyeExam) => <div className="eye-exam-customer"><Avatar>{exam.customer?.name.slice(0, 1).toUpperCase() ?? '?'}</Avatar><div><strong>{exam.customer?.name ?? 'Khách hàng đã xóa'}</strong><span>{exam.customer?.phone ?? 'Không có số điện thoại'}</span></div></div> },
          { title: 'Mắt phải · OD', width: 200, render: (_: unknown, exam: EyeExam) => <span className="eye-exam-rx">{formatRx(exam.rSph, exam.rCyl, exam.rAxis)}</span> },
          { title: 'Mắt trái · OS', width: 200, render: (_: unknown, exam: EyeExam) => <span className="eye-exam-rx">{formatRx(exam.lSph, exam.lCyl, exam.lAxis)}</span> },
          { title: 'Trạng thái', width: 120, render: (_: unknown, exam: EyeExam) => <span className={exam.lockedAt ? 'eye-exam-status eye-exam-status--locked' : 'eye-exam-status'}><i />{exam.lockedAt ? 'Đã chốt' : 'Bản nháp'}</span> },
          {
            title: '', width: 104, align: 'center',
            render: (_: unknown, exam: EyeExam) => {
              const items: MenuProps['items'] = [
                ...(exam.lockedAt ? [{ key: 'print', icon: <PrinterOutlined />, label: 'In phiếu' }] : []),
                { key: 'history', icon: <HistoryOutlined />, label: 'Xem lịch sử' },
                ...(exam.lockedAt
                  ? [{ key: 'unlock', icon: <UnlockOutlined />, label: 'Mở chốt phiếu' }]
                  : [{ key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' }]),
                { type: 'divider' },
                { key: 'archive', icon: <InboxOutlined />, label: 'Lưu trữ', danger: true },
              ];
              return <Space size={2}><Button className="eye-exam-action" type="text" icon={<EyeOutlined />} title="Xem phiếu đo" aria-label={`Xem phiếu đo ngày ${exam.examDate}`} onClick={(event) => { event.stopPropagation(); setDetailExamId(exam.id); }} /><Dropdown overlayClassName="eye-exam-actions-menu" menu={{ items, onClick: ({ key, domEvent }) => { domEvent.stopPropagation(); runMenuAction(exam, key); } }} trigger={['click']}><Button className="eye-exam-action" type="text" icon={<MoreOutlined />} title="Thao tác khác" aria-label={`Thao tác với phiếu đo ngày ${exam.examDate}`} onClick={(event) => event.stopPropagation()} /></Dropdown></Space>;
            },
          },
        ]}
      />
    </Card>
    <EyeExamForm open={open} exam={selected} customerId={search.get('customerId') ?? undefined} onClose={closeForm} onSubmit={save} loading={createState.isLoading || finalizeState.isLoading || updateState.isLoading || finalizeExistingState.isLoading} />
    <EyeExamDetailModal
      examId={detailExamId}
      onClose={() => setDetailExamId(null)}
      onEdit={(exam) => { setDetailExamId(null); setSelected(exam); setOpen(true); }}
      onFinalize={finalizeDraft}
      finalizing={lockState.isLoading}
    />
    <EyeExamPrintModal examId={printExamId} onClose={() => setPrintExamId(null)} />
    <EyeExamHistoryModal exam={historyExam} open={Boolean(historyExam)} onClose={() => setHistoryExam(null)} />
    <EyeExamArchiveModal open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    <EyeExamImportModal open={importOpen} onClose={() => setImportOpen(false)} />
  </div>;
}
