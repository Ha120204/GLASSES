'use client';

import { CalendarOutlined, DownloadOutlined, EditOutlined, EyeOutlined, InboxOutlined, MoreOutlined, PlusOutlined, PrinterOutlined, SearchOutlined, UnlockOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, DatePicker, Dropdown, Input, Modal, Select, Space, Table, message, type MenuProps } from 'antd';
import dayjs from 'dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  type EyeExamSortBy,
  type EyeExamStatusFilter,
  useArchiveEyeExamMutation,
  useBulkArchiveEyeExamsMutation,
  useCreateEyeExamMutation,
  useCustomerQuery,
  useEyeExamsQuery,
  useFinalizeExistingEyeExamMutation,
  useFinalizeEyeExamMutation,
  useLockEyeExamMutation,
  useUnlockEyeExamMutation,
  useUpdateEyeExamMutation,
} from '@/store/api';

const isExamDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value).isValid() && dayjs(value).format('YYYY-MM-DD') === value);
const pageSizes = [10, 20, 50, 100];

export default function EyeExamsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const queryString = search.toString();
  const q = search.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  const searchResetPending = useRef(false);
  const dateFrom = search.get('dateFrom');
  const dateTo = search.get('dateTo');
  const dateRange: [string, string] | undefined = isExamDate(dateFrom) && isExamDate(dateTo) && dateFrom <= dateTo ? [dateFrom, dateTo] : undefined;
  const rawStatus = search.get('status');
  const status: EyeExamStatusFilter | undefined = rawStatus === 'DRAFT' || rawStatus === 'LOCKED' ? rawStatus : undefined;
  const customerId = search.get('customerId') || undefined;
  const requestedPage = Number(search.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(search.get('pageSize'));
  const pageSize = pageSizes.includes(requestedPageSize) ? requestedPageSize : 10;
  const rawSortBy = search.get('sortBy');
  const sortBy: EyeExamSortBy = rawSortBy === 'customerName' || rawSortBy === 'status' ? rawSortBy : 'examDate';
  const sortDirection = search.get('sortDirection') === 'asc' ? 'asc' : 'desc';
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localOpen, setOpen] = useState(false);
  const createOpen = search.get('create') === '1';
  const open = createOpen || localOpen;
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<EyeExam | null>(null);
  const activeExam = createOpen ? null : selected;
  const [detailExamId, setDetailExamId] = useState<string | null>(null);
  const [printExamId, setPrintExamId] = useState<string | null>(null);
  const [historyExam, setHistoryExam] = useState<EyeExam | null>(null);
  const [messageApi, holder] = message.useMessage();
  const { data, isFetching, isError, refetch: refetchExams } = useEyeExamsQuery({ q: q || undefined, customerId, dateFrom: dateRange?.[0], dateTo: dateRange?.[1], status, sortBy, sortDirection, page, pageSize });
  const { data: selectedCustomer } = useCustomerQuery(customerId ?? '', { skip: !customerId });
  const [create, createState] = useCreateEyeExamMutation();
  const [finalize, finalizeState] = useFinalizeEyeExamMutation();
  const [update, updateState] = useUpdateEyeExamMutation();
  const [finalizeExisting, finalizeExistingState] = useFinalizeExistingEyeExamMutation();
  const [lock, lockState] = useLockEyeExamMutation();
  const [unlock] = useUnlockEyeExamMutation();
  const [archive] = useArchiveEyeExamMutation();
  const [bulkArchive, bulkArchiveState] = useBulkArchiveEyeExamsMutation();

  useEffect(() => {
    const syncFromHistory = (): void => {
      setQInput(new URLSearchParams(window.location.search).get('q') ?? '');
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);
  useEffect(() => {
    if (searchResetPending.current) {
      if (q) return;
      searchResetPending.current = false;
    }
    if (qInput.trim() === q) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(queryString);
      if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
      params.delete('page');
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, q, qInput, queryString, router]);
  useEffect(() => { setSelectedIds([]); }, [queryString]);

  const closeForm = (): void => {
    setOpen(false);
    setSelected(null);
    if (createOpen) {
      const params = new URLSearchParams(queryString);
      params.delete('create');
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    }
  };

  const updateFilters = (changes: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(queryString);
    if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
    Object.entries(changes).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    if (!Object.hasOwn(changes, 'page')) params.delete('page');
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    setSelectedIds([]);
  };

  const resetFilters = (): void => {
    const params = new URLSearchParams(queryString);
    ['q', 'dateFrom', 'dateTo', 'status', 'customerId', 'page'].forEach((key) => params.delete(key));
    searchResetPending.current = true;
    setQInput('');
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    setSelectedIds([]);
  };

  const hasFilters = Boolean(qInput.trim() || q || dateRange || status || customerId);
  const exportExams = (ids?: string[]): void => { const params = new URLSearchParams(); if (ids?.length) params.set('ids', ids.join(',')); else { if (q) params.set('q', q); if (customerId) params.set('customerId', customerId); if (dateRange?.[0]) params.set('dateFrom', dateRange[0]); if (dateRange?.[1]) params.set('dateTo', dateRange[1]); if (status) params.set('status', status); } params.set('sortBy', sortBy); params.set('sortDirection', sortDirection); window.location.assign(`/api/eye-exams/export${params.size ? `?${params.toString()}` : ''}`); };

  const save = async (values: EyeExamInput, intent: 'draft' | 'finalize', idempotencyKey: string): Promise<void> => {
    try {
      if (activeExam) {
        if (intent === 'finalize') await finalizeExisting({ id: activeExam.id, data: values }).unwrap();
        else await update({ id: activeExam.id, data: values }).unwrap();
      } else if (intent === 'finalize') await finalize({ ...values, idempotencyKey }).unwrap();
      else await create({ ...values, idempotencyKey }).unwrap();
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
      } else if (key === 'unlock') unlockExam(exam);
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
        <div className="eye-exams-toolbar__header">
          <div className="eye-exams-toolbar__intro">
            <span className="eye-exams-toolbar__icon"><CalendarOutlined /></span>
            <div><strong>Danh sách phiếu đo</strong><span>Theo dõi các phiếu đo của khách hàng.</span></div>
          </div>
          <div className="eye-exams-toolbar__meta">
            {customerId ? <span className="eye-exams-toolbar__customer-context">Khách: <strong>{selectedCustomer?.name ?? 'Đang tải...'}</strong></span> : null}
            <span className="eye-exams-toolbar__summary">Có <b>{data?.total ?? 0}</b> phiếu đang hoạt động</span>
          </div>
        </div>
        <div className="eye-exams-toolbar__filters">
          <Input className="eye-exams-search" prefix={<SearchOutlined />} allowClear value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="Tìm mã phiếu, tên hoặc số điện thoại" aria-label="Tìm phiếu đo theo mã, tên hoặc số điện thoại" />
          <DatePicker.RangePicker
            className="eye-exams-date-filter"
            value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={(values) => { const [from, to] = values ?? []; updateFilters({ dateFrom: from && to ? from.format('YYYY-MM-DD') : undefined, dateTo: from && to ? to.format('YYYY-MM-DD') : undefined }); }}
          />
          <div className="eye-exams-toolbar__status-actions">
            <Select<EyeExamStatusFilter>
              className="eye-exams-status-filter"
              allowClear
              placeholder="Trạng thái"
              value={status}
              options={[{ value: 'DRAFT', label: 'Bản nháp' }, { value: 'LOCKED', label: 'Đã chốt' }]}
              onChange={(value) => updateFilters({ status: value })}
            />
            {hasFilters ? <Button className="eye-exams-clear-filters" type="link" onClick={resetFilters}>Xóa lọc</Button> : null}
          </div>
        </div>
      </div>
      {selectedIds.length > 0 && <div className="eye-exams-bulk-actions">
        <strong>Đã chọn {selectedIds.length} phiếu đo</strong>
        <Space wrap size={8}>
          <Button type="link" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
          <Button type="link" icon={<DownloadOutlined />} onClick={() => exportExams(selectedIds)}>Xuất Excel</Button>
          <Button danger icon={<InboxOutlined />} loading={bulkArchiveState.isLoading} onClick={archiveSelected}>Lưu trữ đã chọn</Button>
        </Space>
      </div>}
      {isError ? <Alert className="eye-exams-error" type="error" showIcon message="Không thể tải danh sách phiếu đo." action={<Button size="small" loading={isFetching} onClick={() => void refetchExams()}>Thử lại</Button>} /> : null}
      <Table<EyeExam>
        className="eye-exams-table"
        rowKey="id"
        loading={isFetching}
        dataSource={data?.items}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys.map(String)), columnWidth: 48 }}
        onRow={(exam) => ({ onClick: () => setDetailExamId(exam.id) })}
        onChange={(_pagination, _filters, sorting, extra) => {
          if (extra.action !== 'sort') return;
          const next = Array.isArray(sorting) ? sorting[0] : sorting;
          const nextSortBy = next.columnKey === 'customerName' || next.columnKey === 'status' ? next.columnKey : 'examDate';
          updateFilters({ sortBy: next.order && nextSortBy !== 'examDate' ? nextSortBy : undefined, sortDirection: next.order === 'ascend' ? 'asc' : undefined });
        }}
        scroll={{ x: 1270 }}
        locale={{
          emptyText: isError ? 'Danh sách chưa được tải.' : 'Chưa có phiếu đo mắt nào.',
          triggerAsc: 'Nhấn để sắp xếp tăng dần',
          triggerDesc: 'Nhấn để sắp xếp giảm dần',
          cancelSort: 'Nhấn để bỏ sắp xếp',
        }}
        pagination={{
          current: page, total: data?.total, pageSize,
          showSizeChanger: { showSearch: false }, pageSizeOptions: [10, 20, 50, 100], locale: { items_per_page: '/ trang' },
          onChange: (nextPage, nextPageSize) => updateFilters({ page: nextPageSize === pageSize && nextPage > 1 ? String(nextPage) : undefined, pageSize: nextPageSize > 10 ? String(nextPageSize) : undefined }),
        }}
        columns={[
          { title: 'STT', key: 'index', width: 66, render: (_: unknown, _exam: EyeExam, index: number) => <span className="eye-exam-index">{(page - 1) * pageSize + index + 1}</span> },
          { title: 'Mã phiếu', dataIndex: 'code', width: 130 },
          { title: 'Ngày đo', dataIndex: 'examDate', key: 'examDate', width: 142, sorter: true, sortDirections: ['descend', 'ascend', 'descend'], sortOrder: sortBy === 'examDate' ? sortDirection === 'asc' ? 'ascend' : 'descend' : null, render: (value: string) => <div className="eye-exam-date"><strong>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))}</strong><span>Phiếu đo khúc xạ</span></div> },
          { title: 'Khách hàng', key: 'customerName', width: 250, sorter: true, sortDirections: ['ascend', 'descend', 'ascend'], sortOrder: sortBy === 'customerName' ? sortDirection === 'asc' ? 'ascend' : 'descend' : null, render: (_: unknown, exam: EyeExam) => <div className="eye-exam-customer"><Avatar>{exam.customer?.name.slice(0, 1).toUpperCase() ?? '?'}</Avatar><div><strong>{exam.customer?.name ?? 'Khách hàng đã xóa'}</strong><span>{exam.customer?.phone ?? 'Không có số điện thoại'}</span></div></div> },
          { title: 'Mắt phải · OD', width: 200, render: (_: unknown, exam: EyeExam) => <span className="eye-exam-rx">{formatRx(exam.rSph, exam.rCyl, exam.rAxis)}</span> },
          { title: 'Mắt trái · OS', width: 200, render: (_: unknown, exam: EyeExam) => <span className="eye-exam-rx">{formatRx(exam.lSph, exam.lCyl, exam.lAxis)}</span> },
          { title: 'Trạng thái', key: 'status', width: 120, sorter: true, sortDirections: ['ascend', 'descend', 'ascend'], sortOrder: sortBy === 'status' ? sortDirection === 'asc' ? 'ascend' : 'descend' : null, render: (_: unknown, exam: EyeExam) => <span className={exam.lockedAt ? 'eye-exam-status eye-exam-status--locked' : 'eye-exam-status'}><i />{exam.lockedAt ? 'Đã chốt' : 'Bản nháp'}</span> },
          {
            title: '', width: 104, align: 'center',
            render: (_: unknown, exam: EyeExam) => {
              const items: MenuProps['items'] = [
                ...(exam.lockedAt ? [{ key: 'print', icon: <PrinterOutlined />, label: 'In phiếu' }] : []),
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
    <EyeExamForm open={open} exam={activeExam} customerId={search.get('customerId') ?? undefined} onClose={closeForm} onSubmit={save} loading={createState.isLoading || finalizeState.isLoading || updateState.isLoading || finalizeExistingState.isLoading} />
    <EyeExamDetailModal
      examId={detailExamId}
      onClose={() => setDetailExamId(null)}
      onViewHistory={setHistoryExam}
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
