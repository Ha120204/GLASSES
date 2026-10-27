'use client';

import { BarChartOutlined, CalendarOutlined, DollarOutlined, FileTextOutlined, FundOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Spin, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { getErrorMessage, orderStatusColors, orderStatusLabels, paymentMethodLabels, useReportOverviewQuery } from '@/store/api';

type Preset = 'TODAY' | 'SEVEN_DAYS' | 'MONTH' | 'CUSTOM';
const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatCompactMoney = (value: number): string => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const presets: Array<{ value: Exclude<Preset, 'CUSTOM'>; label: string }> = [{ value: 'TODAY', label: 'Hôm nay' }, { value: 'SEVEN_DAYS', label: '7 ngày qua' }, { value: 'MONTH', label: 'Tháng này' }];
const dateRangeForPreset = (preset: Exclude<Preset, 'CUSTOM'>): [Dayjs, Dayjs] => {
  const today = dayjs();
  if (preset === 'TODAY') return [today, today];
  if (preset === 'SEVEN_DAYS') return [today.subtract(6, 'day'), today];
  return [today.startOf('month'), today];
};
function MetricCard({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: string }) { return <Card className={`reports-metric reports-metric--${tone}`}><span className="reports-metric__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><em>{hint}</em></div></Card>; }

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('MONTH');
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => dateRangeForPreset('MONTH'));
  const query = useMemo(() => ({ dateFrom: range[0].format('YYYY-MM-DD'), dateTo: range[1].format('YYYY-MM-DD') }), [range]);
  const { data, isFetching, isError, error } = useReportOverviewQuery(query);
  const dailySales = useMemo(() => {
    if (!data) return [];
    const valuesByDate = new Map(data.dailySales.map((item) => [item.date, item]));
    const days: Array<{ date: string; sales: number; orders: number }> = [];
    for (let day = range[0].startOf('day'); !day.isAfter(range[1], 'day'); day = day.add(1, 'day')) { const date = day.format('YYYY-MM-DD'); days.push(valuesByDate.get(date) ?? { date, sales: 0, orders: 0 }); }
    return days;
  }, [data, range]);
  const maximumSales = Math.max(...dailySales.map((item) => item.sales), 1);
  const choosePreset = (value: Exclude<Preset, 'CUSTOM'>): void => { setPreset(value); setRange(dateRangeForPreset(value)); };
  const paymentTotal = data ? Math.max(1, ...Object.values(data.paymentByMethod).map((value) => Math.abs(value))) : 1;

  return <div className="product-page reports-page">
    <header className="product-page__hero reports-page__hero"><div><span className="product-page__eyebrow">VẬN HÀNH</span><h1>Báo cáo</h1><p>Theo dõi doanh số, tiền thu và các đơn cần xử lý trong kỳ.</p></div></header>
    <Card className="reports-filter-card"><div className="reports-filter-card__main"><div className="reports-presets">{presets.map((item) => <Button key={item.value} type={preset === item.value ? 'primary' : 'default'} onClick={() => choosePreset(item.value)}>{item.label}</Button>)}</div><DatePicker.RangePicker value={range} format="DD/MM/YYYY" allowClear={false} disabledDate={(current) => current.isAfter(dayjs(), 'day')} suffixIcon={<CalendarOutlined />} onChange={(dates) => { if (!dates?.[0] || !dates[1]) return; setPreset('CUSTOM'); setRange([dates[0], dates[1]]); }} /></div><span>{range[0].format('DD/MM/YYYY')} – {range[1].format('DD/MM/YYYY')}</span></Card>
    {isFetching && !data ? <div className="reports-loading"><Spin /></div> : isError ? <Card className="reports-empty"><Empty description={getErrorMessage(error)} /></Card> : data ? <>
      <p className="reports-definition">Doanh số đơn không gồm đơn hủy. Tiền đã thu gồm tiền cọc, thanh toán và hoàn tiền phát sinh trong kỳ.</p>
      <section className="reports-metrics"><MetricCard tone="sales" icon={<DollarOutlined />} label="Doanh số đơn" value={formatMoney(data.summary.orderSales)} hint={`${data.summary.orderCount} đơn không hủy`} /><MetricCard tone="collected" icon={<FundOutlined />} label="Tiền đã thu" value={formatMoney(data.summary.collected)} hint="Dòng tiền phát sinh trong kỳ" /><MetricCard tone="outstanding" icon={<FileTextOutlined />} label="Còn phải thu" value={formatMoney(data.summary.outstanding)} hint="Của đơn tạo trong kỳ" /><MetricCard tone="action" icon={<WarningOutlined />} label="Cần xử lý" value={`${data.summary.actionNeeded} đơn`} hint="Mới, đặt tròng hoặc gia công" /></section>
      <section className="reports-grid reports-grid--primary"><Card className="reports-panel reports-sales-chart" title="Doanh số theo ngày" extra={<span>{formatMoney(data.summary.orderSales)}</span>}>{dailySales.some((item) => item.sales > 0) ? <div className="reports-chart"><div className="reports-chart__scale"><span>{formatCompactMoney(maximumSales)}</span><span>0</span></div><div className="reports-chart__bars">{dailySales.map((item) => <div className="reports-chart__day" key={item.date} title={`${dayjs(item.date).format('DD/MM')}: ${formatMoney(item.sales)} · ${item.orders} đơn`}><div className="reports-chart__bar-wrap"><i style={{ height: `${Math.max(item.sales ? 5 : 0, item.sales / maximumSales * 100)}%` }} /></div><span>{dailySales.length <= 10 || dayjs(item.date).date() === 1 || dayjs(item.date).day() === 1 ? dayjs(item.date).format('DD/MM') : ''}</span></div>)}</div></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh số trong kỳ" />}</Card><Card className="reports-panel reports-status-panel" title="Tình trạng đơn"><div className="reports-status-list">{Object.entries(orderStatusLabels).map(([status, label]) => <div key={status}><Tag color={orderStatusColors[status as keyof typeof orderStatusColors]}>{label}</Tag><strong>{data.statusCounts[status as keyof typeof data.statusCounts] ?? 0}</strong></div>)}</div></Card></section>
      <section className="reports-grid reports-grid--secondary"><Card className="reports-panel" title="Sản phẩm bán chạy" extra={<BarChartOutlined />}><div className="reports-products">{data.topProducts.length ? data.topProducts.map((item, index) => <div key={item.name}><b>{index + 1}</b><span>{item.name}<em>{item.qty} sản phẩm</em></span><strong>{formatMoney(item.sales)}</strong></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm bán ra" />}</div></Card><Card className="reports-panel" title="Thu tiền theo phương thức"><div className="reports-payments">{Object.entries(paymentMethodLabels).map(([method, label]) => { const value = data.paymentByMethod[method as keyof typeof data.paymentByMethod] ?? 0; return <div key={method}><div><span>{label}</span><strong>{formatMoney(value)}</strong></div><i><b style={{ width: `${Math.max(value ? 4 : 0, Math.abs(value) / paymentTotal * 100)}%` }} /></i></div>; })}</div></Card></section>
    </> : null}
  </div>;
}
