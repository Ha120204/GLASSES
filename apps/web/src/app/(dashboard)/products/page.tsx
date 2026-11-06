'use client';

import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Input, Modal, Pagination, Select, Space, Spin, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type Key } from 'react';
import { ProductForm } from '@/components/product-form';
import { ProductDetailModal } from '@/components/product-detail-modal';
import { ProductTrashModal } from '@/components/product-trash-modal';
import { ProductImportModal } from '@/components/product-import-modal';
import { ProductImage } from '@/components/product-image';
import {
  getErrorMessage,
  type Product,
  type ProductInput,
  type ProductType,
  useCreateProductMutation,
  useDeleteProductMutation,
  useProductsQuery,
  useUpdateProductMutation,
} from '@/store/api';

const productTypeLabels: Record<ProductType, string> = {
  FRAME: 'Gọng kính',
  LENS: 'Tròng kính',
  CONTACT: 'Kính áp tròng',
  ACCESSORY: 'Phụ kiện',
};
type ProductTypeFilter = ProductType | 'ALL';
type ProductSort = 'name:asc' | 'name:desc' | 'salePrice:asc' | 'salePrice:desc' | 'costPrice:asc' | 'costPrice:desc';
const productTypeOptions: Array<{ value: ProductTypeFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả danh mục' },
  ...Object.entries(productTypeLabels).map(([value, label]) => ({ value: value as ProductType, label })),
];
const productSortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: 'name:asc', label: 'Tên A–Z' },
  { value: 'name:desc', label: 'Tên Z–A' },
  { value: 'salePrice:asc', label: 'Giá bán tăng dần' },
  { value: 'salePrice:desc', label: 'Giá bán giảm dần' },
  { value: 'costPrice:asc', label: 'Giá vốn tăng dần' },
  { value: 'costPrice:desc', label: 'Giá vốn giảm dần' },
];
const pageSizes = [10, 20, 50, 100];
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  const requestedType = searchParams.get('type');
  const type = requestedType && requestedType in productTypeLabels ? requestedType as ProductType : undefined;
  const requestedSort = `${searchParams.get('sortBy') ?? 'name'}:${searchParams.get('sortDirection') ?? 'asc'}`;
  const sort = productSortOptions.some((option) => option.value === requestedSort) ? requestedSort as ProductSort : 'name:asc';
  const [sortBy, sortDirection] = sort.split(':') as ['name' | 'salePrice' | 'costPrice', 'asc' | 'desc'];
  const requestedPage = Number(searchParams.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const pageSize = pageSizes.includes(requestedPageSize) ? requestedPageSize : 10;
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { currentData: data, isFetching, isError, refetch } = useProductsQuery({ q: q || undefined, type, sortBy, sortDirection, page, pageSize });
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    if (qInput.trim() === q) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(queryString);
      if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
      params.delete('page');
      router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, q, qInput, router, queryString]);
  useEffect(() => { setSelectedRowKeys([]); }, [queryString]);

  const updateFilters = (changes: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(queryString);
    if (qInput.trim()) params.set('q', qInput.trim()); else params.delete('q');
    Object.entries(changes).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    if (!Object.hasOwn(changes, 'page')) params.delete('page');
    const url = `${pathname}${params.size ? `?${params.toString()}` : ''}`;
    router.push(url, { scroll: false });
    setSelectedRowKeys([]);
  };
  const clearFilters = (): void => { setQInput(''); router.push(pathname, { scroll: false }); setSelectedRowKeys([]); };
  const changePage = (nextPage: number, nextPageSize: number): void => updateFilters({
    page: nextPageSize === pageSize && nextPage > 1 ? String(nextPage) : undefined,
    pageSize: nextPageSize === 10 ? undefined : String(nextPageSize),
  });

  const openCreate = (): void => { setSelected(null); setFormOpen(true); };
  const openEdit = (product: Product): void => { setSelected(product); setFormOpen(true); };
  const openEditFromDetail = (product: Product): void => { setDetail(null); openEdit(product); };
  const updateDetailProduct = (product: Product): void => {
    setDetail(product);
    setSelected((current) => current?.id === product.id ? product : current);
  };
  const save = async (values: ProductInput, savedProductId: string | null): Promise<Product> => {
    const persistedId = selected?.id ?? savedProductId;
    if (persistedId) {
      return updateProduct({ id: persistedId, data: {
        sku: values.sku, name: values.name, type: values.type,
        brand: values.brand, costPrice: values.costPrice, salePrice: values.salePrice,
        supplier: values.supplier, active: values.active,
      } }).unwrap();
    }
    return createProduct(values).unwrap();
  };
  const remove = (product: Product): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--soft-delete product-delete-confirm',
      icon: <DeleteOutlined />,
      title: 'Chuyển sản phẩm vào thùng rác?',
      content: <div className="product-delete-confirm__content"><p>Sản phẩm <strong>“{product.name}”</strong> sẽ được ẩn khỏi danh mục.</p><span>Bạn có thể khôi phục sản phẩm trong Thùng rác.</span></div>,
      okText: 'Chuyển vào thùng rác', cancelText: 'Giữ sản phẩm', okButtonProps: { danger: true },
      width: 480,
      onOk: async () => {
        try {
          await deleteProduct(product.id).unwrap();
          messageApi.success('Đã xóa sản phẩm.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };
  const removeSelected = (): void => {
    const selectedCount = selectedRowKeys.length;
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--soft-delete product-delete-confirm',
      icon: <DeleteOutlined />,
      title: `Chuyển ${selectedCount} sản phẩm vào thùng rác?`,
      content: <div className="product-delete-confirm__content"><p>Các sản phẩm đã chọn sẽ được ẩn khỏi danh mục.</p><span>Bạn có thể khôi phục từng sản phẩm trong Thùng rác.</span></div>,
      okText: 'Chuyển vào thùng rác', cancelText: 'Giữ sản phẩm', okButtonProps: { danger: true },
      width: 480,
      onOk: async () => {
        const results = await Promise.allSettled(selectedRowKeys.map((id) => deleteProduct(String(id)).unwrap()));
        const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
        const failedCount = selectedCount - deletedCount;
        setSelectedRowKeys([]);
        if (failedCount) {
          messageApi.warning(`Đã chuyển ${deletedCount}/${selectedCount} sản phẩm vào thùng rác. Vui lòng thử lại các sản phẩm còn lại.`);
        } else {
          messageApi.success(`Đã chuyển ${deletedCount} sản phẩm vào thùng rác.`);
        }
      },
    });
  };
  const exportProducts = (ids?: Key[]): void => {
    const params = new URLSearchParams();
    if (ids?.length) params.set('ids', ids.map(String).join(','));
    else {
      if (q) params.set('q', q);
      if (type) params.set('type', type);
      if (sort !== 'name:asc') { params.set('sortBy', sortBy); params.set('sortDirection', sortDirection); }
    }
    window.location.assign(`/api/products/export${params.size ? `?${params.toString()}` : ''}`);
  };
  const columns = useMemo<TableColumnsType<Product>>(() => [
    {
      title: 'Sản phẩm', width: 360,
      render: (_: unknown, product: Product) => <div className="product-identity">
        <ProductImage product={product} size="list" />
        <div>
          <button type="button" className="product-identity__open" aria-label={`Xem chi tiết sản phẩm ${product.name}`} onClick={(event) => { event.stopPropagation(); setDetail(product); }}>
            <strong>{product.name}</strong>
          </button>
          <span><b>SKU</b> {product.sku}{product.brand ? ` · ${product.brand}` : ''}</span>
        </div>
      </div>,
    },
    { title: 'Danh mục', dataIndex: 'type', responsive: ['md'], render: (value: ProductType) => <span className={`product-type product-type--${value.toLowerCase()}`}>{productTypeLabels[value]}</span> },
    {
      title: 'Giá bán', align: 'right', responsive: ['md'],
      render: (_: unknown, product: Product) => <div className="product-price"><strong>{formatMoney(product.salePrice)}</strong><span>Giá vốn {formatMoney(product.costPrice)}</span></div>,
    },
    { title: 'Trạng thái', dataIndex: 'active', responsive: ['lg'], render: (active: boolean) => <span className={`product-status ${active ? 'product-status--active' : ''}`}><i />{active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span> },
    {
      title: 'Thao tác', width: 164, align: 'center',
      render: (_: unknown, product: Product) => <Space size={4} className="product-actions">
        <Button type="text" className="product-action product-action--edit" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); openEdit(product); }}>Chỉnh sửa</Button>
        <Tooltip title="Xóa"><Button danger type="text" className="product-action" icon={<DeleteOutlined />} aria-label="Xóa sản phẩm" onClick={(event) => { event.stopPropagation(); remove(product); }} /></Tooltip>
      </Space>,
    },
  ], [deleteProduct, messageApi]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: Key[]) => setSelectedRowKeys(keys),
    columnWidth: 52,
  };
  const total = data?.total ?? 0;
  const firstItem = total ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(firstItem + (data?.items.length ?? 0) - 1, total);
  const hasFilters = Boolean(q || type);
  const pageItems = data?.items ?? [];
  const allPageItemsSelected = pageItems.length > 0 && pageItems.every((product) => selectedRowKeys.includes(product.id));
  const somePageItemsSelected = pageItems.some((product) => selectedRowKeys.includes(product.id));
  const toggleProductSelection = (productId: Key, checked: boolean): void => {
    setSelectedRowKeys((current) => checked ? [...current, productId] : current.filter((key) => key !== productId));
  };
  const emptyState = <div className="product-empty-state" role={isError ? 'alert' : undefined}>
    <strong>{isError ? 'Không thể tải danh sách sản phẩm' : hasFilters ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm'}</strong>
    <p>{isError ? 'Kiểm tra kết nối và thử lại.' : hasFilters ? 'Thử từ khóa hoặc danh mục khác.' : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý danh mục.'}</p>
    {isError ? <Button onClick={() => void refetch()}>Thử lại</Button>
      : hasFilters ? <Button onClick={clearFilters}>Xóa bộ lọc</Button>
        : <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm sản phẩm</Button>}
  </div>;

  return <div className="product-page products-page">
    {contextHolder}
    <header className="product-page__hero">
      <div><span className="product-page__eyebrow">HÀNG HÓA</span><h1>Danh mục sản phẩm</h1><p>Tra cứu, cập nhật giá và kiểm soát sản phẩm đang kinh doanh.</p></div>
      <Space wrap className="product-page__actions">
        <Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm sản phẩm</Button>
        <Button className="product-excel-button" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập Excel</Button>
        <Button className="product-excel-button" icon={<DownloadOutlined />} onClick={() => exportProducts()}>Xuất Excel</Button>
        <Button icon={<DeleteOutlined />} onClick={() => setTrashOpen(true)}>Thùng rác</Button>
      </Space>
    </header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <div className="product-toolbar">
        <div className="product-toolbar__filters">
          <Input className="product-search" prefix={<SearchOutlined />} allowClear value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="Tìm tên, mã sản phẩm hoặc thương hiệu" aria-label="Tìm sản phẩm" />
          <Select className="product-type-select" value={type ?? 'ALL'} onChange={(value: ProductTypeFilter) => updateFilters({ type: value === 'ALL' ? undefined : value })} options={productTypeOptions} aria-label="Lọc theo danh mục" />
          <Select className="product-sort-select" value={sort} onChange={(value: ProductSort) => { const [nextSortBy, nextDirection] = value.split(':'); updateFilters({ sortBy: nextSortBy === 'name' && nextDirection === 'asc' ? undefined : nextSortBy, sortDirection: nextSortBy === 'name' && nextDirection === 'asc' ? undefined : nextDirection }); }} options={productSortOptions} aria-label="Sắp xếp sản phẩm" />
          {hasFilters && <Button className="product-clear-filters" type="text" onClick={clearFilters}>Xóa bộ lọc</Button>}
        </div>
        <span className="product-toolbar__summary">{isError ? 'Không thể cập nhật danh sách' : total ? <>Hiển thị <b>{firstItem}–{lastItem}</b> trong {total} sản phẩm</> : isFetching ? 'Đang tải sản phẩm...' : hasFilters ? 'Không có kết quả phù hợp' : 'Chưa có sản phẩm'}</span>
      </div>
      {selectedRowKeys.length > 0 && <div className="product-bulk-bar" role="status">
        <span><b>Đã chọn {selectedRowKeys.length}</b> sản phẩm</span>
        <Space size={4} wrap>
          <Button type="text" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
          <Button type="text" icon={<DownloadOutlined />} onClick={() => exportProducts(selectedRowKeys)}>Xuất Excel</Button>
          <Button danger type="text" icon={<DeleteOutlined />} onClick={removeSelected}>Chuyển vào thùng rác</Button>
        </Space>
      </div>}
      {isError && !isFetching && pageItems.length > 0 && <Alert className="product-list-error" type="error" showIcon message="Không thể cập nhật danh sách sản phẩm." action={<Button size="small" onClick={() => void refetch()}>Thử lại</Button>} />}
      <Table<Product>
        className="product-table"
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isFetching}
        rowSelection={rowSelection}
        onRow={(product) => ({ onClick: () => setDetail(product) })}
        scroll={{ x: 900 }}
        locale={{ emptyText: emptyState }}
        pagination={{ current: page, pageSize, total, showSizeChanger: { showSearch: false }, pageSizeOptions: pageSizes, locale: { items_per_page: '/ trang' }, hideOnSinglePage: false, onChange: changePage, showTotal: (count, range) => `${range[0]}–${range[1]} trong ${count} sản phẩm` }}
      />
      <div className="product-mobile" aria-label="Danh sách sản phẩm">
        {isFetching ? <div className="product-mobile__loading" role="status"><Spin /><span>Đang tải sản phẩm...</span></div> : pageItems.length > 0 ? <>
          <div className="product-mobile__select-all">
            <Checkbox
              checked={allPageItemsSelected}
              indeterminate={somePageItemsSelected && !allPageItemsSelected}
              onChange={(event) => setSelectedRowKeys(event.target.checked ? pageItems.map((product) => product.id) : [])}
            >Chọn tất cả trên trang</Checkbox>
          </div>
          <div className="product-mobile__list">
            {pageItems.map((product) => <article className={`product-mobile-card${selectedRowKeys.includes(product.id) ? ' product-mobile-card--selected' : ''}`} key={product.id}>
              <div className="product-mobile-card__header">
                <Checkbox checked={selectedRowKeys.includes(product.id)} onChange={(event) => toggleProductSelection(product.id, event.target.checked)} aria-label={`Chọn sản phẩm ${product.name}`} />
                <div className="product-identity">
                  <ProductImage product={product} size="list" />
                  <div>
                    <button type="button" className="product-identity__open" aria-label={`Xem chi tiết sản phẩm ${product.name}`} onClick={() => setDetail(product)}><strong>{product.name}</strong></button>
                    <span><b>SKU</b> {product.sku}{product.brand ? ` · ${product.brand}` : ''}</span>
                  </div>
                </div>
              </div>
              <div className="product-mobile-card__details">
                <div><span>Giá bán</span><strong>{formatMoney(product.salePrice)}</strong></div>
                <div><span>Giá vốn</span><strong>{formatMoney(product.costPrice)}</strong></div>
                <div><span>Danh mục</span><span className={`product-type product-type--${product.type.toLowerCase()}`}>{productTypeLabels[product.type]}</span></div>
                <div><span>Trạng thái</span><span className={`product-status ${product.active ? 'product-status--active' : ''}`}><i />{product.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span></div>
              </div>
              <div className="product-mobile-card__actions">
                <Button onClick={() => setDetail(product)}>Chi tiết</Button>
                <Button icon={<EditOutlined />} onClick={() => openEdit(product)}>Sửa</Button>
                <Button danger icon={<DeleteOutlined />} aria-label={`Xóa sản phẩm ${product.name}`} onClick={() => remove(product)} />
              </div>
            </article>)}
          </div>
          <div className="product-mobile__pagination">
            <Pagination simple current={page} pageSize={pageSize} total={total} showSizeChanger={false} onChange={changePage} />
            <Select aria-label="Số sản phẩm mỗi trang" value={pageSize} options={pageSizes.map((size) => ({ value: size, label: `${size} / trang` }))} onChange={(size: number) => changePage(1, size)} />
          </div>
        </> : <div className="product-mobile__empty">{emptyState}</div>}
      </div>
    </Card>
    <ProductForm open={formOpen} product={selected} loading={createState.isLoading || updateState.isLoading} onClose={() => setFormOpen(false)} onSubmit={save} onSaved={() => { messageApi.success(selected ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.'); setFormOpen(false); }} />
    <ProductDetailModal product={detail} open={detail !== null} onClose={() => setDetail(null)} onEdit={openEditFromDetail} onProductUpdated={updateDetailProduct} />
    <ProductTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
    <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} />
  </div>;
}
