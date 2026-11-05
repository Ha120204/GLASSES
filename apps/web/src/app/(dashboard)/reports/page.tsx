'use client';

import { BarChartOutlined, CalendarOutlined, DollarOutlined, FileTextOutlined, FundOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Empty, Spin, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getErrorMessage, orderStatusColors, orderStatusLabels, paymentMethodLabels, useReportOverviewQuery, type ReportOverview } from '@/store/api';

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
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const parseReportDay = (value: string | null): Dayjs | null => {
  if (!value || !dateOnlyPattern.test(value)) return null;
  const date = dayjs(value);
  return date.isValid() && date.format('YYYY-MM-DD') === value ? date : null;
};
const readReportPeriod = (queryString: string): { range: [Dayjs, Dayjs]; preset: Preset; invalid: boolean } => {
  const params = new URLSearchParams(queryString);
  const fallback = { range: dateRangeForPreset('MONTH'), preset: 'MONTH' as Preset, invalid: false };
  if (!params.has('dateFrom') && !params.has('dateTo') && !params.has('preset')) return fallback;
  const from = parseReportDay(params.get('dateFrom'));
  const to = parseReportDay(params.get('dateTo'));
  if (!from || !to || from.isAfter(to, 'day') || to.isAfter(dayjs(), 'day')) return { ...fallback, invalid: true };
  const requestedPreset = params.get('preset');
  const matchingPreset = presets.find(({ value }) => {
    if (value !== requestedPreset) return false;
    const [expectedFrom, expectedTo] = dateRangeForPreset(value);
    return from.isSame(expectedFrom, 'day') && to.isSame(expectedTo, 'day');
  });
  return { range: [from, to], preset: matchingPreset?.value ?? 'CUSTOM', invalid: false };
};

type ChartGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';
type ChartBucket = { key: string; label: string; axisLabel: string; sales: number; orders: number };
const chartTitles: Record<ChartGranularity, string> = {
  day: 'Doanh số theo ngày',
  week: 'Doanh số theo tuần',
  month: 'Doanh số theo tháng',
  quarter: 'Doanh số theo quý',
  year: 'Doanh số theo năm',
};

function buildChartBuckets(data: ReportOverview, range: [Dayjs, Dayjs]): { title: string; granularity: ChartGranularity; buckets: ChartBucket[] } {
  const from = range[0].startOf('day');
  const to = range[1].startOf('day');
  const dayCount = to.diff(from, 'day') + 1;
  const granularity: ChartGranularity = dayCount <= 31 ? 'day' : dayCount <= 180 ? 'week' : dayCount <= 730 ? 'month' : dayCount <= 2190 ? 'quarter' : 'year';
  const valuesByDate = new Map(data.dailySales.map((item) => [item.date, item]));
  const buckets: ChartBucket[] = [];

  for (let start = from; !start.isAfter(to, 'day');) {
    const periodEnd = granularity === 'day' ? start
      : granularity === 'week' ? start.add(6 - ((start.day() + 6) % 7), 'day')
        : granularity === 'month' ? start.endOf('month')
          : granularity === 'quarter' ? start.month(Math.floor(start.month() / 3) * 3 + 2).endOf('month')
            : start.endOf('year');
    const end = periodEnd.isAfter(to, 'day') ? to : periodEnd;
    let sales = 0;
    let orders = 0;
    for (let day = start; !day.isAfter(end, 'day'); day = day.add(1, 'day')) {
      const value = valuesByDate.get(day.format('YYYY-MM-DD'));
      sales += value?.sales ?? 0;
      orders += value?.orders ?? 0;
    }
    const label = start.isSame(end, 'day') ? start.format('DD/MM/YYYY') : `${start.format('DD/MM/YYYY')} – ${end.format('DD/MM/YYYY')}`;
    const axisLabel = granularity === 'day' ? (dayCount <= 10 || start.date() === 1 || start.day() === 1 ? start.format('DD/MM') : '')
      : granularity === 'week' ? start.format('DD/MM')
        : granularity === 'month' ? start.format('MM/YY')
          : granularity === 'quarter' ? `Q${Math.floor(start.month() / 3) + 1}/${start.format('YY')}`
            : start.format('YYYY');
    buckets.push({ key: start.format('YYYY-MM-DD'), label, axisLabel, sales, orders });
    start = end.add(1, 'day');
  }

  return { title: chartTitles[granularity], granularity, buckets };
}
function MetricCard({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: string }) { return <Card className={`reports-metric reports-metric--${tone}`}><span className="reports-metric__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><em>{hint}</em></div></Card>; }

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryString = useSearchParams().toString();
  const { range, preset, invalid } = useMemo(() => readReportPeriod(queryString), [queryString]);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  useEffect(() => {
    if (!invalid) return;
    const params = new URLSearchParams(queryString);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('preset');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }, [invalid, pathname, queryString, router]);
  useEffect(() => { setSelectedBucketKey(null); }, [queryString]);
  const query = useMemo(() => ({ dateFrom: range[0].format('YYYY-MM-DD'), dateTo: range[1].format('YYYY-MM-DD') }), [range]);
  const { currentData: data, isFetching, isError, error, refetch } = useReportOverviewQuery(query);
  const chart = useMemo(() => data ? buildChartBuckets(data, range) : null, [data, range]);
  const maximumSales = Math.max(...(chart?.buckets.map((item) => item.sales) ?? []), 1);
  const selectedBucket = chart?.buckets.find((item) => item.key === selectedBucketKey);
  const updateRange = (nextRange: [Dayjs, Dayjs], nextPreset: Preset): void => {
    const params = new URLSearchParams(queryString);
    params.set('dateFrom', nextRange[0].format('YYYY-MM-DD'));
    params.set('dateTo', nextRange[1].format('YYYY-MM-DD'));
    params.set('preset', nextPreset);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setSelectedBucketKey(null);
  };
  const choosePreset = (value: Exclude<Preset, 'CUSTOM'>): void => updateRange(dateRangeForPreset(value), value);
  const paymentTotal = data ? Math.max(1, ...Object.values(data.paymentByMethod).map((value) => Math.abs(value))) : 1;

  return <div className="product-page reports-page">
    <header className="product-page__hero reports-page__hero"><div><span className="product-page__eyebrow">VẬN HÀNH</span><h1>Báo cáo</h1><p>Theo dõi doanh số, tiền thu và các đơn đang thực hiện trong kỳ.</p></div></header>
    <Card className="reports-filter-card"><div className="reports-filter-card__main"><div className="reports-presets">{presets.map((item) => <Button key={item.value} type={preset === item.value ? 'primary' : 'default'} aria-pressed={preset === item.value} onClick={() => choosePreset(item.value)}>{item.label}</Button>)}</div><DatePicker.RangePicker value={range} format="DD/MM/YYYY" allowClear={false} disabledDate={(current) => current.isAfter(dayjs(), 'day')} suffixIcon={<CalendarOutlined />} onChange={(dates) => { if (!dates?.[0] || !dates[1] || dates[0].isAfter(dates[1], 'day') || dates[1].isAfter(dayjs(), 'day')) return; updateRange([dates[0], dates[1]], 'CUSTOM'); }} /></div><span>{range[0].format('DD/MM/YYYY')} – {range[1].format('DD/MM/YYYY')}</span></Card>
    {isFetching && !data ? <div className="reports-loading" role="status"><Spin /><span>Đang tải báo cáo…</span></div> : isError ? <Card className="reports-empty"><Empty description={getErrorMessage(error)}><Button onClick={() => void refetch()}>Thử lại</Button></Empty></Card> : data ? <div>
      {isFetching && <div className="reports-updating" role="status"><Spin size="small" /><span>Đang cập nhật số liệu cho kỳ đã chọn…</span></div>}
      <p className="reports-definition">Doanh số đơn không gồm đơn hủy. Tiền đã thu là dòng tiền ròng: tiền cọc của đơn tạo trong kỳ cộng thanh toán, trừ hoàn tiền phát sinh trong kỳ.</p>
      <section className="reports-metrics"><MetricCard tone="sales" icon={<DollarOutlined />} label="Doanh số đơn" value={formatMoney(data.summary.orderSales)} hint={`${data.summary.orderCount} đơn không hủy`} /><MetricCard tone="collected" icon={<FundOutlined />} label="Tiền đã thu" value={formatMoney(data.summary.collected)} hint="Dòng tiền phát sinh trong kỳ" /><MetricCard tone="outstanding" icon={<FileTextOutlined />} label="Còn phải thu" value={formatMoney(data.summary.outstanding)} hint="Của đơn tạo trong kỳ" /><MetricCard tone="action" icon={<WarningOutlined />} label="Đang thực hiện" value={`${data.summary.inProgress} đơn`} hint="Chờ khách lấy kính hoặc hoàn tất đơn" /></section>
      <section className="reports-grid reports-grid--primary">
        <Card className="reports-panel reports-sales-chart" title={chart?.title} extra={<span>{formatMoney(data.summary.orderSales)}</span>}>
          {chart?.buckets.some((item) => item.sales > 0) ? <>
            <div className="reports-chart">
              <div className="reports-chart__scale"><span>{formatCompactMoney(maximumSales)}</span><span>0</span></div>
              <div className={`reports-chart__bars${chart.granularity === 'day' ? '' : ' reports-chart__bars--grouped'}`} role="group" aria-label={chart.title}>
                {chart.buckets.map((item) => <div className="reports-chart__day" key={item.key}>
                  <button
                    type="button"
                    className={`reports-chart__bar-wrap${selectedBucketKey === item.key ? ' reports-chart__bar-wrap--selected' : ''}`}
                    aria-label={`${item.label}: ${formatMoney(item.sales)}, ${item.orders} đơn`}
                    aria-pressed={selectedBucketKey === item.key}
                    title={`${item.label}: ${formatMoney(item.sales)} · ${item.orders} đơn`}
                    onClick={() => setSelectedBucketKey(item.key)}
                    onFocus={() => setSelectedBucketKey(item.key)}
                  ><i style={{ height: `${Math.max(item.sales ? 5 : 0, item.sales / maximumSales * 100)}%` }} /></button>
                  <span>{item.axisLabel}</span>
                </div>)}
              </div>
            </div>
            <div className="reports-chart__detail" role="status">
              {selectedBucket ? <><strong>{selectedBucket.label}</strong><span>{formatMoney(selectedBucket.sales)} · {selectedBucket.orders} đơn</span></> : 'Chọn một cột để xem doanh số và số đơn.'}
            </div>
          </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có doanh số trong kỳ" />}
        </Card>
        <Card className="reports-panel reports-status-panel" title="Tình trạng đơn"><div className="reports-status-list">{Object.entries(orderStatusLabels).map(([status, label]) => <div key={status}><Tag color={orderStatusColors[status as keyof typeof orderStatusColors]}>{label}</Tag><strong>{data.statusCounts[status as keyof typeof data.statusCounts] ?? 0}</strong></div>)}</div></Card>
      </section>
      <section className="reports-grid reports-grid--secondary"><Card className="reports-panel" title="Sản phẩm bán chạy" extra={<BarChartOutlined />}><div className="reports-products">{data.topProducts.length ? data.topProducts.map((item, index) => <div key={item.name}><b>{index + 1}</b><span>{item.name}<em>{item.qty} sản phẩm</em></span><strong>{formatMoney(item.sales)}</strong></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm bán ra" />}</div></Card><Card className="reports-panel" title="Thu tiền theo phương thức"><div className="reports-payments">{Object.entries(paymentMethodLabels).map(([method, label]) => { const value = data.paymentByMethod[method as keyof typeof data.paymentByMethod] ?? 0; return <div key={method}><div><span>{label}</span><strong>{formatMoney(value)}</strong></div><i><b style={{ width: `${Math.max(value ? 4 : 0, Math.abs(value) / paymentTotal * 100)}%` }} /></i></div>; })}</div></Card></section>
    </div> : null}
  </div>;
}
