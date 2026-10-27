'use client';

import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Input, Modal, Select, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useMemo, useState, type Key } from 'react';
import { ProductForm } from '@/components/product-form';
import { ProductDetailModal } from '@/components/product-detail-modal';
import { ProductTrashModal } from '@/components/product-trash-modal';
import { ProductImportModal } from '@/components/product-import-modal';
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
const productTypeOptions: Array<{ value: ProductTypeFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả danh mục' },
  ...Object.entries(productTypeLabels).map(([value, label]) => ({ value: value as ProductType, label })),
];
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

export default function ProductsPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<ProductType>();
  const [page, setPage] = useState(1);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useProductsQuery({ q: q || undefined, type, page, pageSize: 10 });
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

  const clearFilters = (): void => {
    setQ('');
    setType(undefined);
    setPage(1);
    setSelectedRowKeys([]);
  };

  const openCreate = (): void => { setSelected(null); setFormOpen(true); };
  const openEdit = (product: Product): void => { setSelected(product); setFormOpen(true); };
  const openEditFromDetail = (product: Product): void => { setDetail(null); openEdit(product); };
  const updateDetailProduct = (product: Product): void => {
    setDetail(product);
    setSelected((current) => current?.id === product.id ? product : current);
  };
  const save = async (values: ProductInput): Promise<void> => {
    try {
      if (selected) {
        await updateProduct({ id: selected.id, data: {
          sku: values.sku, barcode: values.barcode, name: values.name, type: values.type,
          brand: values.brand, costPrice: values.costPrice, salePrice: values.salePrice,
          supplier: values.supplier, active: values.active,
        } }).unwrap();
      } else {
        await createProduct(values).unwrap();
      }
      messageApi.success(selected ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
      setFormOpen(false);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
  const remove = (product: Product): void => {
    Modal.confirm({
      title: 'Xóa sản phẩm?',
      content: `Sản phẩm “${product.name}” sẽ bị ẩn khỏi danh mục.`,
      okText: 'Xóa', cancelText: 'Hủy', okButtonProps: { danger: true },
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
      title: `Xóa ${selectedCount} sản phẩm đã chọn?`,
      content: 'Các sản phẩm sẽ được chuyển vào thùng rác và có thể khôi phục sau.',
      okText: 'Chuyển vào thùng rác', cancelText: 'Hủy', okButtonProps: { danger: true },
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
    }
    window.location.assign(`/api/products/export${params.size ? `?${params.toString()}` : ''}`);
  };
  const columns = useMemo<TableColumnsType<Product>>(() => [
    {
      title: 'Sản phẩm', width: 360,
      render: (_: unknown, product: Product) => <div className="product-identity">
        <span className={`product-identity__initial product-identity__initial--${product.type.toLowerCase()}`}>{product.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{product.name}</strong><span><b>SKU</b> {product.sku}{product.brand ? ` · ${product.brand}` : ''}</span></div>
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
  const firstItem = total ? ((data?.page ?? page) - 1) * (data?.pageSize ?? 10) + 1 : 0;
  const lastItem = Math.min(firstItem + (data?.items.length ?? 0) - 1, total);
  const hasFilters = Boolean(q || type);

  return <div className="product-page">
    {contextHolder}
    <header className="product-page__hero">
      <div><span className="product-page__eyebrow">HÀNG HÓA</span><h1>Danh mục sản phẩm</h1><p>Tra cứu, cập nhật giá và kiểm soát sản phẩm đang kinh doanh.</p></div>
      <Space wrap>
        <Button icon={<DeleteOutlined />} onClick={() => setTrashOpen(true)}>Thùng rác</Button>
        <Button className="product-excel-button" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>Nhập Excel</Button>
        <Button className="product-excel-button" icon={<DownloadOutlined />} onClick={() => exportProducts()}>Xuất Excel</Button>
        <Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm sản phẩm</Button>
      </Space>
    </header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <div className="product-toolbar">
        <div className="product-toolbar__filters">
          <Input className="product-search" prefix={<SearchOutlined />} allowClear value={q} onChange={(event) => { setQ(event.target.value); setPage(1); setSelectedRowKeys([]); }} placeholder="Tìm tên, SKU hoặc mã vạch" aria-label="Tìm sản phẩm" />
          <Select className="product-type-select" value={type ?? 'ALL'} onChange={(value: ProductTypeFilter) => { setType(value === 'ALL' ? undefined : value); setPage(1); setSelectedRowKeys([]); }} options={productTypeOptions} aria-label="Lọc theo danh mục" />
          {hasFilters && <Button className="product-clear-filters" type="text" onClick={clearFilters}>Xóa bộ lọc</Button>}
        </div>
        <span className="product-toolbar__summary">{total ? <>Hiển thị <b>{firstItem}–{lastItem}</b> trong {total} sản phẩm</> : 'Chưa có sản phẩm'}</span>
      </div>
      {selectedRowKeys.length > 0 && <div className="product-bulk-bar" role="status">
        <span><b>Đã chọn {selectedRowKeys.length}</b> sản phẩm</span>
        <Space size={4}>
          <Button type="text" onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
          <Button type="text" icon={<DownloadOutlined />} onClick={() => exportProducts(selectedRowKeys)}>Xuất Excel</Button>
          <Button danger type="text" icon={<DeleteOutlined />} onClick={removeSelected}>Chuyển vào thùng rác</Button>
        </Space>
      </div>}
      <Table<Product>
        className="product-table"
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isFetching}
        rowSelection={rowSelection}
        onRow={(product) => ({ onClick: () => setDetail(product) })}
        scroll={{ x: 900 }}
        locale={{ emptyText: isError ? 'Không thể tải danh sách. Vui lòng thử lại.' : 'Chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên.' }}
        pagination={{ current: data?.page ?? page, pageSize: data?.pageSize ?? 10, total, showSizeChanger: false, hideOnSinglePage: true, onChange: (nextPage) => { setPage(nextPage); setSelectedRowKeys([]); }, showTotal: (count, range) => `${range[0]}–${range[1]} trong ${count} sản phẩm` }}
      />
    </Card>
    <ProductForm open={formOpen} product={selected} loading={createState.isLoading || updateState.isLoading} onClose={() => setFormOpen(false)} onSubmit={save} />
    <ProductDetailModal product={detail} open={detail !== null} onClose={() => setDetail(null)} onEdit={openEditFromDetail} onProductUpdated={updateDetailProduct} />
    <ProductTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
    <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} />
  </div>;
}
