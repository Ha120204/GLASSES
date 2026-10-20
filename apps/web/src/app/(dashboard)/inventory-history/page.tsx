'use client';

import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Input, Select, Table, Tag, type TableColumnsType } from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { type StockMovementHistoryItem, type StockMovementType, useStockMovementHistoryQuery } from '@/store/api';

const movementLabels: Record<StockMovementType, string> = {
  IN: 'Nhập kho',
  OUT: 'Xuất kho',
  ADJUST: 'Điều chỉnh',
};
const movementOptions = Object.entries(movementLabels).map(([value, label]) => ({ value, label }));
const formatDateTime = (value: string): string => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));

export default function InventoryHistoryPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<StockMovementType>();
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [page, setPage] = useState(1);
  const { data, isFetching, isError } = useStockMovementHistoryQuery({
    q: q || undefined,
    type,
    dateFrom: dateFrom?.format('YYYY-MM-DD'),
    dateTo: dateTo?.format('YYYY-MM-DD'),
    page,
    pageSize: 20,
  });

  const clearFilters = (): void => {
    setQ('');
    setType(undefined);
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  };

  const columns = useMemo<TableColumnsType<StockMovementHistoryItem>>(() => [
    { title: 'Thời gian', dataIndex: 'createdAt', width: 155, render: formatDateTime },
    {
      title: 'Sản phẩm',
      render: (_: unknown, movement: StockMovementHistoryItem) => <div className="product-identity">
        <span className="product-identity__initial">{movement.product.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{movement.product.name}</strong>
          <span>{movement.product.sku}{movement.product.deletedAt ? ' · Đã xóa' : ''}</span>
        </div>
      </div>,
    },
    {
      title: 'Loại biến động',
      dataIndex: 'type',
      width: 135,
      render: (value: StockMovementType, movement: StockMovementHistoryItem) => <Tag color={movement.qty >= 0 ? 'green' : 'volcano'}>{movementLabels[value]}</Tag>,
    },
    {
      title: 'Số lượng',
      dataIndex: 'qty',
      align: 'right',
      width: 105,
      render: (value: number) => <b className={value >= 0 ? 'stock-history__qty--in' : 'stock-history__qty--out'}>{value >= 0 ? '+' : ''}{value}</b>,
    },
    { title: 'Ghi chú', dataIndex: 'note', responsive: ['md'], render: (value: string | null) => value || '—' },
  ], []);

  return <div className="product-page inventory-history-page">
    <header className="product-page__hero">
      <div>
        <span className="product-page__eyebrow">HÀNG HÓA & TỒN KHO</span>
        <h1>Lịch sử kho</h1>
        <p>Theo dõi toàn bộ thao tác nhập, xuất và điều chỉnh tồn kho.</p>
      </div>
    </header>
    <Card className="product-workspace" styles={{ body: { padding: 0 } }}>
      <div className="product-toolbar inventory-history__filters">
        <Input
          className="product-search"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm tên, mã sản phẩm, mã vạch"
          value={q}
          onChange={(event) => { setQ(event.target.value); setPage(1); }}
        />
        <Select
          className="product-type-select"
          allowClear
          placeholder="Tất cả biến động"
          value={type}
          options={movementOptions}
          onChange={(value: StockMovementType | undefined) => { setType(value); setPage(1); }}
        />
        <DatePicker value={dateFrom} placeholder="Từ ngày" format="DD/MM/YYYY" onChange={(value) => { setDateFrom(value); setPage(1); }} />
        <DatePicker value={dateTo} placeholder="Đến ngày" format="DD/MM/YYYY" onChange={(value) => { setDateTo(value); setPage(1); }} />
        <Button icon={<ClearOutlined />} onClick={clearFilters}>Xóa lọc</Button>
        <span className="product-toolbar__summary">Có <b>{data?.total ?? 0}</b> biến động</span>
      </div>
      <Table<StockMovementHistoryItem>
        className="product-table"
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isFetching}
        scroll={{ x: 860 }}
        locale={{ emptyText: isError ? 'Không thể tải lịch sử kho. Vui lòng thử lại.' : 'Chưa có biến động kho nào.' }}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? 20,
          total: data?.total,
          showSizeChanger: false,
          onChange: setPage,
          showTotal: (total) => `Tổng ${total} biến động`,
        }}
      />
    </Card>
  </div>;
}
