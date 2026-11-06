'use client';

import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Space, Table, Tooltip, message, type TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
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

async function runInBatches(ids: string[], action: (id: string) => Promise<unknown>): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let index = 0; index < ids.length; index += 5) {
    results.push(...await Promise.allSettled(ids.slice(index, index + 5).map((id) => Promise.resolve().then(() => action(id)))));
  }
  return results;
}

export function ProductTrashModal({ open, onClose }: ProductTrashModalProps) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [failedItems, setFailedItems] = useState<{ name: string; reason: string }[]>([]);
  const [bulkPending, setBulkPending] = useState<'restore' | 'delete' | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const { data, isFetching, isError } = useDeletedProductsQuery(
    { q: q || undefined, page, pageSize },
    { skip: !open },
  );
  const [restoreProduct, restoreState] = useRestoreProductMutation();
  const [permanentlyDeleteProduct, permanentlyDeleteState] = usePermanentlyDeleteProductMutation();
  const busy = restoreState.isLoading || permanentlyDeleteState.isLoading || bulkPending !== null;

  useEffect(() => {
    if (data && page > 1 && data.total <= (page - 1) * data.pageSize) {
      setPage(Math.max(1, Math.ceil(data.total / data.pageSize)));
    }
  }, [data, page]);

  const close = (): void => {
    if (busy) return;
    setQ('');
    setPage(1);
    setPageSize(10);
    setSelectedIds([]);
    setSelectedNames({});
    setFailedItems([]);
    onClose();
  };

  const removeSelected = (idsToRemove: string[]): void => {
    const removed = new Set(idsToRemove);
    setSelectedIds((ids) => ids.filter((id) => !removed.has(id)));
    setSelectedNames((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))));
  };

  const restore = async (product: Product): Promise<void> => {
    try {
      await restoreProduct(product.id).unwrap();
      removeSelected([product.id]);
      messageApi.success(`Đã khôi phục “${product.name}”.`);
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const permanentlyRemove = (product: Product): void => {
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: 'Xóa vĩnh viễn sản phẩm?',
      content: `“${product.name}” sẽ không thể khôi phục. Sản phẩm đã xuất hiện trong đơn hàng sẽ không được phép xóa vĩnh viễn.`,
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      zIndex: 1100,
      onOk: async () => {
        try {
          await permanentlyDeleteProduct(product.id).unwrap();
          removeSelected([product.id]);
          messageApi.success('Đã xóa vĩnh viễn sản phẩm.');
        } catch (error: unknown) {
          messageApi.error(getErrorMessage(error));
        }
      },
    });
  };

  const restoreSelected = async (): Promise<void> => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    setBulkPending('restore');
    setFailedItems([]);
    const results = await runInBatches(ids, (id) => restoreProduct(id).unwrap());
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: getErrorMessage(result.reason) }]
      : []);
    removeSelected(ids.filter((_, index) => results[index].status === 'fulfilled'));
    setFailedItems(failures);
    const restored = ids.length - failures.length;
    if (restored) messageApi.success(`Đã khôi phục ${restored} sản phẩm.`);
    if (failures.length) messageApi.warning(`${failures.length} sản phẩm chưa được khôi phục. Xem lý do bên dưới.`);
    setBulkPending(null);
  };

  const permanentlyRemoveSelected = (): void => {
    if (!selectedIds.length || busy) return;
    const ids = [...selectedIds];
    Modal.confirm({
      className: 'customer-action-confirm customer-action-confirm--permanent-delete',
      icon: <DeleteOutlined />,
      title: `Xóa vĩnh viễn ${ids.length} sản phẩm đã chọn?`,
      content: 'Thao tác này không thể khôi phục. Sản phẩm đã xuất hiện trong đơn hàng sẽ được giữ lại trong thùng rác và báo lý do.',
      okText: 'Xóa vĩnh viễn',
      cancelText: 'Quay lại',
      okButtonProps: { danger: true },
      zIndex: 1100,
      onOk: async () => {
        setBulkPending('delete');
        setFailedItems([]);
        const results = await runInBatches(ids, (id) => permanentlyDeleteProduct(id).unwrap());
        const failures = results.flatMap((result, index) => result.status === 'rejected'
          ? [{ name: selectedNames[ids[index]] ?? ids[index], reason: getErrorMessage(result.reason) }]
          : []);
        removeSelected(ids.filter((_, index) => results[index].status === 'fulfilled'));
        setFailedItems(failures);
        const deleted = ids.length - failures.length;
        if (deleted) messageApi.success(`Đã xóa vĩnh viễn ${deleted} sản phẩm.`);
        if (failures.length) messageApi.warning(`${failures.length} sản phẩm không thể xóa vĩnh viễn. Xem lý do bên dưới.`);
        setBulkPending(null);
      },
    });
  };

  const columns = useMemo<TableColumnsType<Product>>(() => [
    {
      title: 'Sản phẩm',
      render: (_: unknown, product: Product) => <div className="product-identity">
        <span className={`product-identity__initial product-identity__initial--${product.type.toLowerCase()}`}>{product.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{product.name}</strong><span><b>SKU</b> {product.sku}{product.brand ? ` · ${product.brand}` : ''}</span></div>
      </div>,
    },
    { title: 'Đã xóa lúc', dataIndex: 'deletedAt', responsive: ['sm'], render: formatDeletedAt },
    {
      title: 'Thao tác', width: 190, align: 'center',
      render: (_: unknown, product: Product) => <Space size={2}>
        <Button type="text" className="product-trash-action product-trash-action--restore" icon={<ReloadOutlined />} disabled={busy} onClick={() => void restore(product)}>Khôi phục</Button>
        <Tooltip title="Xóa vĩnh viễn"><Button danger type="text" icon={<DeleteOutlined />} aria-label={`Xóa vĩnh viễn ${product.name}`} disabled={busy} onClick={() => permanentlyRemove(product)} /></Tooltip>
      </Space>,
    },
  ], [busy]);

  return <Modal
    className="product-trash-modal"
    title={<div className="product-trash-modal__title"><span>THÙNG RÁC</span><strong>Sản phẩm đã xóa</strong><p>Khôi phục hoặc xóa vĩnh viễn các sản phẩm không còn dùng.</p></div>}
    open={open}
    onCancel={close}
    footer={<Button className="product-trash-modal__close" disabled={busy} onClick={close}>Đóng</Button>}
    width={760}
  >
    {contextHolder}
    <p className="product-trash-modal__notice">Chọn ô bên trái để xử lý nhiều sản phẩm cùng lúc. Khôi phục sẽ đưa sản phẩm trở lại danh mục. Sản phẩm đã xuất hiện trong đơn hàng không thể xóa vĩnh viễn.</p>
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder="Tìm tên hoặc mã sản phẩm"
      value={q}
      onChange={(event) => { setQ(event.target.value); setPage(1); setSelectedIds([]); setSelectedNames({}); setFailedItems([]); }}
      disabled={busy}
      style={{ marginBottom: 16 }}
    />
    {selectedIds.length > 0 && <div className="product-trash-modal__bulk-actions">
      <strong>Đã chọn {selectedIds.length} sản phẩm</strong>
      <Space wrap size={8}>
        <Button type="link" disabled={busy} onClick={() => { setSelectedIds([]); setSelectedNames({}); }}>Bỏ chọn</Button>
        <Button icon={<ReloadOutlined />} loading={bulkPending === 'restore'} disabled={busy} onClick={() => void restoreSelected()}>Khôi phục đã chọn</Button>
        <Button danger icon={<DeleteOutlined />} loading={bulkPending === 'delete'} disabled={busy} onClick={permanentlyRemoveSelected}>Xóa vĩnh viễn đã chọn</Button>
      </Space>
    </div>}
    {failedItems.length > 0 && <Alert className="product-trash-modal__failures" type="warning" showIcon message={`${failedItems.length} sản phẩm chưa được xử lý`} description={<ul>{failedItems.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}:</strong> {item.reason}</li>)}</ul>} closable onClose={() => setFailedItems([])} />}
    <Table<Product>
      className="product-trash-modal__table"
      rowKey="id"
      rowSelection={{
        selectedRowKeys: selectedIds,
        preserveSelectedRowKeys: true,
        columnWidth: 46,
        getCheckboxProps: () => ({ disabled: busy }),
        onChange: (keys, rows) => {
          if (keys.length > 100) {
            messageApi.warning('Chỉ có thể chọn tối đa 100 sản phẩm mỗi lần.');
            return;
          }
          const ids = keys.map(String);
          setSelectedIds(ids);
          setSelectedNames((current) => {
            const next = Object.fromEntries(ids.filter((id) => id in current).map((id) => [id, current[id]]));
            rows.forEach((product) => { next[product.id] = product.name; });
            return next;
          });
        },
      }}
      columns={columns}
      dataSource={data?.items ?? []}
      loading={isFetching}
      size="small"
      locale={{ emptyText: isError ? 'Không thể tải thùng rác. Vui lòng thử lại.' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Thùng rác đang trống" /> }}
      pagination={{
        current: page,
        pageSize,
        total: data?.total,
        showSizeChanger: { showSearch: false },
        pageSizeOptions: [10, 20, 50, 100],
        locale: { items_per_page: '/ trang' },
        hideOnSinglePage: false,
        onChange: (nextPage, nextPageSize) => { if (!busy) { setPage(nextPageSize === pageSize ? nextPage : 1); setPageSize(nextPageSize); } },
        showTotal: (total) => `Tổng ${total} sản phẩm`,
      }}
    />
  </Modal>;
}
