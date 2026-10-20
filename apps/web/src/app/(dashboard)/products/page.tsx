'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, Input, Modal, Select, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { ProductForm } from '@/components/product-form';
import { ProductDetailModal } from '@/components/product-detail-modal';
import { ProductTrashModal } from '@/components/product-trash-modal';
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
const productTypeOptions = Object.entries(productTypeLabels).map(([value, label]) => ({ value, label }));
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

export default function ProductsPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<ProductType>();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useProductsQuery({ q: q || undefined, type, page, pageSize: 10 });
  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [deleteProduct] = useDeleteProductMutation();

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
          minStock: values.minStock, supplier: values.supplier, active: values.active,
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
  const columns = useMemo<TableColumnsType<Product>>(() => [
    {
      title: 'Sản phẩm', width: 330,
      render: (_: unknown, product: Product) => <div className="product-identity">
        <span className={`product-identity__initial product-identity__initial--${product.type.toLowerCase()}`}>{product.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{product.name}</strong><span>{product.sku}{product.brand ? ` · ${product.brand}` : ''}</span></div>
      </div>,
    },
    { title: 'Danh mục', dataIndex: 'type', responsive: ['md'], render: (value: ProductType) => <span className={`product-type product-type--${value.toLowerCase()}`}>{productTypeLabels[value]}</span> },
    {
      title: 'Giá', align: 'right', responsive: ['md'],
      render: (_: unknown, product: Product) => <div className="product-price"><strong>{formatMoney(product.salePrice)}</strong><span>Vốn {formatMoney(product.costPrice)}</span></div>,
    },
    {
      title: 'Tồn kho', align: 'center',
      render: (_: unknown, product: Product) => {
        const isLow = product.stockQty <= product.minStock;
        return <div className={`product-stock ${isLow ? 'product-stock--low' : ''}`}>
          <strong>{product.stockQty}</strong><span>{isLow ? `Cần nhập · tối thiểu ${product.minStock}` : `Tối thiểu ${product.minStock}`}</span>
        </div>;
      },
    },
    { title: 'Trạng thái', dataIndex: 'active', responsive: ['lg'], render: (active: boolean) => <span className={`product-status ${active ? 'product-status--active' : ''}`}><i />{active ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span> },
    {
      title: '', width: 108,
      render: (_: unknown, product: Product) => <Space size={2}>
        <Tooltip title="Chỉnh sửa"><Button type="text" className="product-action" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={(event) => { event.stopPropagation(); openEdit(product); }} /></Tooltip>
        <Tooltip title="Xóa"><Button danger type="text" className="product-action" icon={<DeleteOutlined />} aria-label="Xóa sản phẩm" onClick={(event) => { event.stopPropagation(); remove(product); }} /></Tooltip>
      </Space>,
    },
  ], []);

  return <div className="product-page">
    {contextHolder}
    <header className="product-page__hero">
      <div><span className="product-page__eyebrow">HÀNG HÓA & TỒN KHO</span><h1>Sản phẩm & Kho</h1><p>Quản lý danh mục, giá bán và mức tồn tối thiểu tại cửa hàng.</p></div>
      <Space wrap>
        <Button icon={<DeleteOutlined />} onClick={() => setTrashOpen(true)}>Thùng rác</Button>
        <Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm sản phẩm</Button>
      </Space>
    </header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <div className="product-toolbar">
        <div className="product-toolbar__filters">
          <Input className="product-search" prefix={<SearchOutlined />} allowClear value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Tìm tên, mã sản phẩm, mã vạch" />
          <Select className="product-type-select" allowClear value={type} onChange={(value: ProductType | undefined) => { setType(value); setPage(1); }} options={productTypeOptions} placeholder="Tất cả danh mục" />
        </div>
        <span className="product-toolbar__summary">Danh mục hiện có <b>{data?.total ?? 0}</b> sản phẩm</span>
      </div>
      <Table<Product>
        className="product-table"
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isFetching}
        onRow={(product) => ({ onClick: () => setDetail(product) })}
        scroll={{ x: 900 }}
        locale={{ emptyText: isError ? 'Không thể tải danh sách. Vui lòng thử lại.' : 'Chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên.' }}
        pagination={{ current: data?.page ?? page, pageSize: data?.pageSize ?? 10, total: data?.total, showSizeChanger: false, onChange: setPage, showTotal: (total) => `Tổng ${total} sản phẩm` }}
      />
    </Card>
    <ProductForm open={formOpen} product={selected} loading={createState.isLoading || updateState.isLoading} onClose={() => setFormOpen(false)} onSubmit={save} />
    <ProductDetailModal product={detail} open={detail !== null} onClose={() => setDetail(null)} onEdit={openEditFromDetail} onProductUpdated={updateDetailProduct} />
    <ProductTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
  </div>;
}
