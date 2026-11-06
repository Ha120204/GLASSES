'use client';

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  IdcardOutlined,
  MoreOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Modal,
  Pagination,
  Result,
  Select,
  Spin,
  Space,
  Table,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CustomerForm } from '@/components/customer-form';
import { CustomerImportModal } from '@/components/customer-import-modal';
import { CustomerProfileModal } from '@/components/customer-profile-modal';
import { CustomerTrashModal } from '@/components/customer-trash-modal';
import {
  getErrorMessage,
  type Customer,
  type CustomerInput,
  type CustomerListQuery,
  useCreateCustomerMutation,
  useBulkDeleteCustomersMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/store/api';

const genderLabels: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
const pageSizes = [10, 20, 50, 100];
type CustomerGender = NonNullable<CustomerListQuery['gender']>;
type CustomerSort = 'createdAt:desc' | 'createdAt:asc' | 'name:asc' | 'name:desc';
const sortOptions: Array<{ value: CustomerSort; label: string }> = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'createdAt:asc', label: 'Cũ nhất' },
  { value: 'name:asc', label: 'Tên A–Z' },
  { value: 'name:desc', label: 'Tên Z–A' },
];

export default function CustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  const rawGender = searchParams.get('gender');
  const gender: CustomerGender | undefined = rawGender && rawGender in genderLabels ? rawGender as CustomerGender : undefined;
  const requestedSort = `${searchParams.get('sortBy') ?? 'createdAt'}:${searchParams.get('sortDirection') ?? 'desc'}`;
  const sort = sortOptions.some((option) => option.value === requestedSort) ? requestedSort as CustomerSort : 'createdAt:desc';
  const [sortBy, sortDirection] = sort.split(':') as [NonNullable<CustomerListQuery['sortBy']>, NonNullable<CustomerListQuery['sortDirection']>];
  const requestedPage = Number(searchParams.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const pageSize = pageSizes.includes(requestedPageSize) ? requestedPageSize : 10;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const createOpen = searchParams.get('create') === '1';
  const fromOverview = searchParams.get('source') === 'overview';
  const formOpen = createOpen || editFormOpen;
  const [nextCustomer, setNextCustomer] = useState<Customer | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const activeCustomer = createOpen ? null : selected;
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError, refetch } = useCustomersQuery({
    q: q || undefined,
    gender,
    sortBy,
    sortDirection,
    page,
    pageSize,
  });
  const [createCustomer, createState] = useCreateCustomerMutation();
  const [updateCustomer, updateState] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();
  const [bulkDeleteCustomers, bulkDeleteState] = useBulkDeleteCustomersMutation();

  useEffect(() => {
    const syncFromHistory = (): void => {
      setQInput(new URLSearchParams(window.location.search).get('q') ?? '');
    };
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, []);
  useEffect(() => {
    if (qInput.trim() === q) return;
    const timer = window.setTimeout(() => {
      const nextQuery = qInput.trim();
      const params = new URLSearchParams(window.location.search);
      if (nextQuery) params.set('q', nextQuery); else params.delete('q');
      params.delete('page');
      window.history.replaceState(null, '', `${pathname}${params.size ? `?${params.toString()}` : ''}`);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, q, qInput, queryString]);
  useEffect(() => { setSelectedIds([]); }, [queryString]);

  const updateFilters = (changes: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(queryString);
    if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
    Object.entries(changes).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    if (!Object.hasOwn(changes, 'page')) params.delete('page');
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    setSelectedIds([]);
  };
  const clearFilters = (): void => {
    setQInput('');
    const params = new URLSearchParams();
    if (pageSize !== 10) params.set('pageSize', String(pageSize));
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    setSelectedIds([]);
  };
  const hasFilters = Boolean(q || gender || sort !== 'createdAt:desc');

  const openCreate = (): void => {
    setNextCustomer(null);
    setSelected(null);
    setEditFormOpen(false);
    const params = new URLSearchParams(queryString);
    params.set('create', '1');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const openEdit = (customer: Customer): void => {
    setSelected(customer);
    setEditFormOpen(true);
  };
  const closeForm = (): void => {
    setEditFormOpen(false);
    setSelected(null);
    if (createOpen) {
      const params = new URLSearchParams(queryString);
      params.delete('create');
      params.delete('source');
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    }
  };
  const save = async (values: CustomerInput): Promise<void> => {
    try {
      let createdCustomer: Customer | null = null;
      if (activeCustomer) await updateCustomer({ id: activeCustomer.id, data: values }).unwrap();
      else createdCustomer = await createCustomer(values).unwrap();
      if (createdCustomer && fromOverview) setNextCustomer(createdCustomer);
      else messageApi.success(activeCustomer ? 'Đã cập nhật khách hàng.' : 'Đã thêm khách hàng.');
      closeForm();
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
  const remove = (customer: Customer): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--soft-delete',
      icon: <DeleteOutlined />,
      title: 'Chuyển khách hàng vào Thùng rác?',
      content: `Khách hàng “${customer.name}” sẽ bị xóa mềm và không còn xuất hiện trong danh sách.`,
      okText: 'Chuyển vào Thùng rác',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCustomer(customer.id).unwrap();
          messageApi.success('Đã xóa khách hàng.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };
  const exportCustomers = (ids?: string[]): void => {
    const selected = ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : '';
    window.location.assign(`/api/customers/export${selected}`);
  };
  const removeSelected = (): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--soft-delete',
      icon: <DeleteOutlined />,
      title: `Chuyển ${selectedIds.length} khách hàng vào Thùng rác?`,
      content: 'Các hồ sơ đã chọn sẽ bị xóa mềm và có thể khôi phục trong Thùng rác.',
      okText: 'Chuyển vào Thùng rác', cancelText: 'Quay lại', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await bulkDeleteCustomers(selectedIds).unwrap();
          setSelectedIds([]);
          messageApi.success(`Đã chuyển ${result.count} khách hàng vào Thùng rác.`);
        } catch (error: unknown) { messageApi.error(getErrorMessage(error)); }
      },
    });
  };
  const columns = useMemo<TableColumnsType<Customer>>(
    () => [
      {
        title: 'STT', key: 'index', width: 66,
        render: (_value: unknown, _customer: Customer, index: number) => <span className="customer-index">{(page - 1) * pageSize + index + 1}</span>,
      },
      {
        title: 'Khách hàng',
        dataIndex: 'name',
        width: 360,
        render: (name: string, record) => <div className="customer-identity">
          <Avatar>{name.slice(0, 1).toUpperCase()}</Avatar>
          <div>
            <strong>{name}</strong>
            <span>{record.address || 'Chưa cập nhật địa chỉ'}</span>
          </div>
        </div>,
      },
      {
        title: 'Liên hệ',
        dataIndex: 'phone',
        width: 270,
        render: (phone: string) => <div className="customer-contact"><span className="customer-phone"><PhoneOutlined /> {phone}</span><span>Liên hệ chính</span></div>,
      },
      {
        title: 'Thông tin',
        dataIndex: 'gender',
        responsive: ['md'],
        render: (gender: string | null) => <div className="customer-meta"><span className={gender ? 'customer-gender' : 'customer-muted'}>{gender ? genderLabels[gender] : 'Chưa cập nhật giới tính'}</span><span><IdcardOutlined /> Hồ sơ khách hàng</span></div>,
      },
      {
        title: 'Ngày tạo hồ sơ',
        dataIndex: 'createdAt',
        responsive: ['lg'],
        render: (value: string) => <span className="customer-created">{new Intl.DateTimeFormat('vi-VN').format(new Date(value))}</span>,
      },
      {
        title: '',
        key: 'actions',
        width: 168,
        render: (_value, customer) => <Space size={2}>
          <Tooltip title="Xem hồ sơ"><Button type="text" className="customer-action" icon={<EyeOutlined />} aria-label="Xem hồ sơ" onClick={(event) => { event.stopPropagation(); setProfileId(customer.id); }} /></Tooltip>
          <Tooltip title="Chỉnh sửa"><Button type="text" className="customer-action" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={(event) => { event.stopPropagation(); openEdit(customer); }} /></Tooltip>
          <Tooltip title="Xóa"><Button danger type="text" className="customer-action" icon={<DeleteOutlined />} aria-label="Xóa" onClick={(event) => { event.stopPropagation(); remove(customer); }} /></Tooltip>
        </Space>,
      },
    ],
    [page, pageSize],
  );
  const hasSearchFilters = Boolean(q || gender);
  const emptyState = isError ? (
    <div className="customers-table__state" role="alert">
      <Result
        status="error"
        title="Không thể tải danh sách khách hàng"
        subTitle="Vui lòng kiểm tra kết nối và thử lại."
        extra={<Button icon={<ReloadOutlined />} onClick={() => void refetch()}>Thử lại</Button>}
      />
    </div>
  ) : (
    <div className="customers-table__state" role="status">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={hasSearchFilters ? 'Không tìm thấy khách hàng phù hợp.' : 'Chưa có khách hàng nào.'}
      >
        {hasSearchFilters
          ? <Button onClick={clearFilters}>Xóa bộ lọc</Button>
          : <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm khách hàng</Button>}
      </Empty>
    </div>
  );
  const visibleCustomers = isError ? [] : data?.items ?? [];
  const selectedVisibleCount = visibleCustomers.filter((customer) => selectedIds.includes(customer.id)).length;
  const changePage = (nextPage: number, nextPageSize: number): void => {
    updateFilters({
      page: nextPageSize === pageSize && nextPage > 1 ? String(nextPage) : undefined,
      pageSize: nextPageSize === 10 ? undefined : String(nextPageSize),
    });
  };
  return (
    <div className="customers-page">
      {contextHolder}
      <header className="customers-page__hero">
        <div>
          <span className="customers-page__eyebrow">KHÁCH HÀNG</span>
          <h1>Khách hàng</h1>
          <p>Quản lý hồ sơ, lịch sử khám mắt và mua hàng của khách.</p>
        </div>
        <Space wrap>
          <Button className="customers-page__trash" icon={<DeleteOutlined />} onClick={() => setTrashOpen(true)}>
            Thùng rác
          </Button>
          <Button className="customers-page__excel" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Nhập Excel
          </Button>
          <Button className="customers-page__excel" icon={<DownloadOutlined />} onClick={() => exportCustomers()}>
            Xuất Excel
          </Button>
          <Button className="customers-page__create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm khách hàng
          </Button>
        </Space>
      </header>
      {nextCustomer && !createOpen ? <Alert className="overview-next-step" type="success" showIcon closable onClose={() => setNextCustomer(null)} message={`Đã thêm khách hàng ${nextCustomer.name}`} description="Tiếp tục tạo đơn hoặc phiếu đo cho khách này." action={<Space wrap><Button type="primary" onClick={() => router.push(`/orders?create=1&customerId=${encodeURIComponent(nextCustomer.id)}`)}>Tạo đơn cho khách</Button><Button onClick={() => router.push(`/eye-exams?create=1&customerId=${encodeURIComponent(nextCustomer.id)}&source=overview`)}>Tạo phiếu đo</Button></Space>} /> : null}
      <Card className="customers-workspace" styles={{ body: { padding: 0 } }}>
        <div className="customers-toolbar">
          <div className="customers-toolbar__intro">
            <span className="customers-toolbar__icon"><TeamOutlined /></span>
            <strong>Danh sách</strong>
          </div>
          <div className="customers-toolbar__filters">
            <Input className="customers-search" prefix={<SearchOutlined />} allowClear value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="Tìm theo tên hoặc số điện thoại…" aria-label="Tìm khách hàng" />
            <Select size="large" className="customers-filter-select" value={gender ?? 'ALL'} onChange={(value: CustomerGender | 'ALL') => updateFilters({ gender: value === 'ALL' ? undefined : value })} options={[{ value: 'ALL', label: 'Mọi giới tính' }, ...Object.entries(genderLabels).map(([value, label]) => ({ value, label }))]} aria-label="Lọc theo giới tính" />
            <Select size="large" className="customers-sort-select" value={sort} onChange={(value: CustomerSort) => { const [nextSortBy, nextDirection] = value.split(':'); updateFilters({ sortBy: value === 'createdAt:desc' ? undefined : nextSortBy, sortDirection: value === 'createdAt:desc' ? undefined : nextDirection }); }} options={sortOptions} aria-label="Sắp xếp khách hàng" />
            {hasFilters && <Button type="text" onClick={clearFilters}>Xóa bộ lọc</Button>}
          </div>
        <span className="customers-toolbar__summary"><b>{isError ? '—' : data?.total ?? 0}</b><span> khách hàng</span></span>
        </div>
        {selectedIds.length > 0 && !isError && <div className="customers-bulk-actions">
          <strong>Đã chọn {selectedIds.length} khách hàng</strong>
          <Space wrap size={8}>
            <Button type="link" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportCustomers(selectedIds)}>Xuất Excel đã chọn</Button>
            <Button danger icon={<DeleteOutlined />} loading={bulkDeleteState.isLoading} onClick={removeSelected}>Chuyển vào Thùng rác</Button>
          </Space>
        </div>}
        <Table<Customer>
          className="customers-table"
          rowKey="id"
          columns={columns}
          dataSource={visibleCustomers}
          loading={{ spinning: isFetching, delay: 300 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys.map(String)),
            columnWidth: 48,
          }}
          onRow={(customer) => ({
            role: 'row',
            tabIndex: 0,
            'aria-label': `Mở hồ sơ khách hàng ${customer.name}`,
            'aria-description': 'Nhấn Enter hoặc phím cách để mở hồ sơ.',
            onClick: (event) => {
              if ((event.target as HTMLElement).closest('button, a, input, label, [role="checkbox"]')) return;
              setProfileId(customer.id);
            },
            onKeyDown: (event) => {
              if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              setProfileId(customer.id);
            },
          })}
          locale={{ emptyText: emptyState }}
          pagination={{
            current: page,
            pageSize,
            total: isError ? 0 : data?.total,
            showSizeChanger: { showSearch: false },
            pageSizeOptions: [10, 20, 50, 100],
            locale: { items_per_page: '/ trang' },
            onChange: changePage,
          }}
          scroll={{ x: 900 }}
        />
        <section className="customers-mobile" aria-label="Danh sách khách hàng">
          {isFetching ? (
            <div className="customers-mobile__loading" role="status"><Spin size="large" /><span>Đang tải khách hàng…</span></div>
          ) : visibleCustomers.length === 0 ? (
            emptyState
          ) : (
            <>
              <div className="customers-mobile__select-all">
                <Checkbox
                  checked={selectedVisibleCount === visibleCustomers.length}
                  indeterminate={selectedVisibleCount > 0 && selectedVisibleCount < visibleCustomers.length}
                  onChange={(event) => setSelectedIds(event.target.checked ? visibleCustomers.map((customer) => customer.id) : [])}
                >Chọn tất cả trang này</Checkbox>
                <span>{visibleCustomers.length} khách hàng</span>
              </div>
              <div className="customers-mobile__list">
                {visibleCustomers.map((customer) => (
                  <article className={`customers-mobile-card${selectedIds.includes(customer.id) ? ' customers-mobile-card--selected' : ''}`} key={customer.id}>
                    <div className="customers-mobile-card__header">
                      <Checkbox
                        checked={selectedIds.includes(customer.id)}
                        aria-label={`Chọn khách hàng ${customer.name}`}
                        onChange={(event) => setSelectedIds((current) => event.target.checked
                          ? [...new Set([...current, customer.id])]
                          : current.filter((id) => id !== customer.id))}
                      />
                      <Avatar>{customer.name.slice(0, 1).toUpperCase()}</Avatar>
                      <div className="customers-mobile-card__identity">
                        <strong>{customer.name}</strong>
                        <span><PhoneOutlined /> {customer.phone}</span>
                      </div>
                      <Dropdown
                        trigger={['click']}
                        placement="bottomRight"
                        menu={{
                          items: [
                            { key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' },
                            { key: 'delete', icon: <DeleteOutlined />, label: 'Chuyển vào Thùng rác', danger: true },
                          ],
                          onClick: ({ key }) => { if (key === 'edit') openEdit(customer); else if (key === 'delete') remove(customer); },
                        }}
                      >
                        <Button className="customers-mobile-card__more" type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${customer.name}`} />
                      </Dropdown>
                    </div>
                    <p className="customers-mobile-card__address">{customer.address || 'Chưa cập nhật địa chỉ'}</p>
                    <div className="customers-mobile-card__meta">
                      <span>{customer.gender ? genderLabels[customer.gender] : 'Chưa cập nhật giới tính'}</span>
                      <span>Tạo ngày {new Intl.DateTimeFormat('vi-VN').format(new Date(customer.createdAt))}</span>
                    </div>
                    <Button className="customers-mobile-card__view" icon={<EyeOutlined />} onClick={() => setProfileId(customer.id)}>Xem hồ sơ</Button>
                  </article>
                ))}
              </div>
              <div className="customers-mobile__pagination">
                <Pagination simple current={page} pageSize={pageSize} total={data?.total ?? 0} onChange={changePage} />
                <Select
                  aria-label="Số khách hàng mỗi trang"
                  value={pageSize}
                  options={pageSizes.map((size) => ({ value: size, label: `${size} / trang` }))}
                  onChange={(size: number) => changePage(1, size)}
                />
              </div>
            </>
          )}
        </section>
      </Card>
      <CustomerForm
        open={formOpen}
        customer={activeCustomer}
        loading={createState.isLoading || updateState.isLoading}
        onClose={closeForm}
        onSubmit={save}
      />
      <CustomerProfileModal
        customerId={profileId}
        onClose={() => setProfileId(null)}
        onEdit={(customer) => { setProfileId(null); openEdit(customer); }}
      />
      <CustomerTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
      <CustomerImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
