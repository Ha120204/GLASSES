'use client';

import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import {
  getErrorMessage,
  type Product,
  useDeletedProductsQuery,
  usePermanentlyDeleteProductMutation,
  useRestoreProductMutation,
} from '@/store/api';

interface ProductTrashModalProps {
  open: boolean;
  onClose: () => void;
}

const formatDeletedAt = (value: string | null): string => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

export function ProductTrashModal({ open, onClose }: ProductTrashModalProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useDeletedProductsQuery(
    { q: q || undefined, page, pageSize: 10 },
    { skip: !open },
  );
  const [restoreProduct, restoreState] = useRestoreProductMutation();
  const [permanentlyDeleteProduct, permanentlyDeleteState] = usePermanentlyDeleteProductMutation();

  const restore = async (product: Product): Promise<void> => {
    try {
      await restoreProduct(product.id).unwrap();
      messageApi.success(`Đã khôi phục “${product.name}”.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const permanentlyRemove = (product: Product): void => {
    Modal.confirm({
      title: 'Xóa vĩnh viễn sản phẩm?',
      content: `“${product.name}” sẽ không thể khôi phục. Sản phẩm đã có lịch sử kho hoặc đơn hàng sẽ không được phép xóa vĩnh viễn.`,
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await permanentlyDeleteProduct(product.id).unwrap();
          messageApi.success('Đã xóa vĩnh viễn sản phẩm.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const columns = useMemo<TableColumnsType<Product>>(() => [
    {
      title: 'Sản phẩm',
      render: (_: unknown, product: Product) => <div className="product-identity">
        <span className={`product-identity__initial product-identity__initial--${product.type.toLowerCase()}`}>{product.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{product.name}</strong><span>{product.sku}{product.brand ? ` · ${product.brand}` : ''}</span></div>
      </div>,
    },
    { title: 'Đã xóa lúc', dataIndex: 'deletedAt', responsive: ['sm'], render: formatDeletedAt },
    {
      title: '', width: 112,
      render: (_: unknown, product: Product) => <Space size={2}>
        <Tooltip title="Khôi phục"><Button type="text" icon={<ReloadOutlined />} aria-label="Khôi phục sản phẩm" loading={restoreState.isLoading} onClick={() => void restore(product)} /></Tooltip>
        <Tooltip title="Xóa vĩnh viễn"><Button danger type="text" icon={<DeleteOutlined />} aria-label="Xóa vĩnh viễn sản phẩm" loading={permanentlyDeleteState.isLoading} onClick={() => permanentlyRemove(product)} /></Tooltip>
      </Space>,
    },
  ], [permanentlyDeleteState.isLoading, restoreState.isLoading]);

  return <Modal
    className="product-trash-modal"
    title={<div><span className="product-drawer__eyebrow">THÙNG RÁC</span><strong>Sản phẩm đã xóa</strong></div>}
    open={open}
    onCancel={onClose}
    footer={<Button onClick={onClose}>Đóng</Button>}
    width={760}
  >
    {contextHolder}
    <p className="product-trash-modal__notice">Khôi phục sẽ đưa sản phẩm trở lại danh mục. Chỉ sản phẩm chưa có lịch sử kho và đơn hàng mới có thể xóa vĩnh viễn.</p>
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder="Tìm tên, mã sản phẩm hoặc mã vạch"
      value={q}
      onChange={(event) => { setQ(event.target.value); setPage(1); }}
      style={{ marginBottom: 16 }}
    />
    <Table<Product>
      rowKey="id"
      columns={columns}
      dataSource={data?.items}
      loading={isFetching}
      size="small"
      locale={{ emptyText: isError ? 'Không thể tải thùng rác. Vui lòng thử lại.' : 'Thùng rác đang trống.' }}
      pagination={{
        current: data?.page ?? page,
        pageSize: data?.pageSize ?? 10,
        total: data?.total,
        showSizeChanger: false,
        onChange: setPage,
        showTotal: (total) => `Tổng ${total} sản phẩm`,
      }}
    />
  </Modal>;
}
