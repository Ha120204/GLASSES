'use client';

import { ArrowRightOutlined, CalendarOutlined, ClockCircleOutlined, DollarOutlined, FileTextOutlined, PlusOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Tag } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage, orderStatusColors, orderStatusLabels, type DashboardOverview, useDashboardOverviewQuery } from '@/store/api';

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatCompactMoney = (value: number): string => {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000)} nghìn`;
  return formatMoney(value);
};
function OverviewMetric({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: string }) { return <Card className={`overview-metric overview-metric--${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></Card>; }
function OverviewLoading() {
  return <div className="overview-loading" role="status" aria-label="Đang tải tổng quan">
    <section className="overview-priority">
      <div className="overview-tasks"><Skeleton active title={{ width: 160 }} paragraph={{ rows: 3 }} /></div>
      <Card className="overview-priority-summary"><Skeleton active title={{ width: 130 }} paragraph={{ rows: 2 }} /></Card>
    </section>
    <section className="overview-metrics">
      {Array.from({ length: 4 }, (_, index) => <Card className="overview-metric" key={index}><Skeleton active title={{ width: '70%' }} paragraph={{ rows: 2 }} /></Card>)}
    </section>
    <section className="overview-grid">
      <Card className="overview-panel"><Skeleton active title={{ width: 130 }} paragraph={{ rows: 4 }} /></Card>
      <Card className="overview-panel"><Skeleton active title={{ width: 170 }} paragraph={{ rows: 4 }} /></Card>
    </section>
  </div>;
}

function PrioritySummary({ tasks, today }: { tasks: DashboardOverview['tasks']; today: string }) {
  const message = tasks.overdue > 0
    ? { title: 'Có đơn quá hẹn', detail: 'Ưu tiên kiểm tra lịch lấy kính và liên hệ khách.' }
    : tasks.dueToday > 0
      ? { title: 'Có đơn hẹn lấy hôm nay', detail: 'Kiểm tra các đơn đến hạn và chuẩn bị bàn giao.' }
      : tasks.inProgress > 0
        ? { title: 'Các đơn đang được thực hiện', detail: 'Theo dõi tiến độ và cập nhật khi đơn sẵn sàng.' }
        : { title: 'Không có đơn cần xử lý', detail: 'Các nhóm việc hiện không có đơn đang chờ.' };

  return <Card className="overview-priority-summary">
    <span>TÓM TẮT ƯU TIÊN · {dayjs(today).format('DD/MM/YYYY')}</span>
    <strong>{message.title}</strong>
    <p>{message.detail}</p>
  </Card>;
}

function SalesChart({ data }: { data: DashboardOverview['dailySales'] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const max = Math.max(...data.map((item) => item.sales), 1);
  const dates = new Map(data.map((item) => [item.date, item.sales]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = dayjs().subtract(6 - index, 'day').format('YYYY-MM-DD');
    return { date, sales: dates.get(date) ?? 0 };
  });
  if (days.every((item) => item.sales === 0)) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có giá trị đơn trong 7 ngày qua" />;

  const selectedDay = days.find((item) => item.date === selectedDate);
  return <div className="overview-sales-content">
    <div className="overview-chart" role="group" aria-label="Giá trị đơn theo từng ngày trong 7 ngày qua">
      {days.map((item) => <button
        key={item.date}
        type="button"
        className="overview-chart__day-button"
        aria-label={`${dayjs(item.date).locale('vi').format('dddd, DD/MM/YYYY')}: ${formatMoney(item.sales)}`}
        aria-pressed={selectedDate === item.date}
        onClick={() => setSelectedDate(item.date)}
      >
        <span className="overview-chart__value" aria-hidden="true">{formatCompactMoney(item.sales)}</span>
        <span className="overview-chart__plot" aria-hidden="true"><i style={{ height: `${Math.max(item.sales ? 6 : 0, item.sales / max * 100)}%` }} /></span>
        <span className="overview-chart__weekday" aria-hidden="true">{dayjs(item.date).locale('vi').format('dd')}</span>
      </button>)}
    </div>
    <p className="overview-chart__detail" aria-live="polite">{selectedDay ? `${dayjs(selectedDay.date).format('DD/MM/YYYY')}: ${formatMoney(selectedDay.sales)}` : 'Chọn một cột để xem giá trị chính xác.'}</p>
    <ol className="overview-visually-hidden" aria-label="Số liệu giá trị đơn theo ngày">
      {days.map((item) => <li key={item.date}>{dayjs(item.date).format('DD/MM/YYYY')}: {formatMoney(item.sales)}</li>)}
    </ol>
  </div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, isFetching, isError, error, refetch } = useDashboardOverviewQuery();
  return <div className="product-page overview-page">
    <header className="product-page__hero overview-page__hero"><div><span className="product-page__eyebrow">TỔNG QUAN CỬA HÀNG</span><h1>Tổng quan</h1><p>{data ? `Ngày ${dayjs(data.today).format('DD/MM/YYYY')} · tập trung vào các việc cần xử lý.` : 'Theo dõi nhanh hoạt động cửa hàng kính mắt.'}</p></div><Button className="product-create-button" type="primary" icon={<PlusOutlined />} onClick={() => router.push('/orders?create=1')}>Tạo đơn hàng</Button></header>
    {isFetching && !data ? <OverviewLoading /> : isError ? <Card className="overview-error"><Alert type="error" showIcon message="Không tải được tổng quan" description={getErrorMessage(error)} action={<Button onClick={() => refetch()}>Thử tải lại</Button>} /></Card> : data ? <>
      <section className="overview-priority" aria-label="Công việc ưu tiên">
        <div className="overview-tasks"><div><h2>Việc cần chú ý</h2><p>Chọn một nhóm để mở danh sách đơn tương ứng.</p></div><div className="overview-task-buttons"><Button className="overview-task overview-task--overdue" onClick={() => router.push('/orders?workFilter=OVERDUE')}><WarningOutlined /><span>Quá hẹn khách lấy</span><b>{data.tasks.overdue}</b><ArrowRightOutlined /></Button><Button className="overview-task overview-task--today" onClick={() => router.push('/orders?workFilter=TODAY')}><CalendarOutlined /><span>Hẹn khách lấy hôm nay</span><b>{data.tasks.dueToday}</b><ArrowRightOutlined /></Button><Button className="overview-task overview-task--action" onClick={() => router.push('/orders?workFilter=IN_PROGRESS')}><ClockCircleOutlined /><span>Đang thực hiện</span><b>{data.tasks.inProgress}</b><ArrowRightOutlined /></Button></div></div>
        <PrioritySummary tasks={data.tasks} today={data.today} />
      </section>
      <section className="overview-metrics"><OverviewMetric tone="collected" icon={<DollarOutlined />} label="Tiền đã thu hôm nay" value={formatMoney(data.summary.collectedToday)} hint="Cọc + thanh toán − hoàn tiền" /><OverviewMetric tone="orders" icon={<FileTextOutlined />} label="Đã giao hôm nay" value={`${data.summary.completedToday} đơn`} hint="Đơn đã hoàn tất trong ngày" /><OverviewMetric tone="outstanding" icon={<TeamOutlined />} label="Còn phải thu" value={formatMoney(data.summary.outstanding)} hint="Toàn bộ đơn đang thực hiện" /><OverviewMetric tone="action" icon={<WarningOutlined />} label="Đang thực hiện" value={`${data.summary.inProgress} đơn`} hint="Chờ khách lấy kính hoặc thu tiền" /></section>
      <section className="overview-grid"><Card className="overview-panel overview-recent" title="Đơn mới nhất" extra={<Button type="link" onClick={() => router.push('/orders')}>Xem tất cả</Button>}>{data.recentOrders.length ? <div className="overview-order-list">{data.recentOrders.map((order) => <button key={order.id} type="button" aria-label={`Mở đơn ${order.code}, ${order.customer.name}, ${order.customer.phone}, ${formatMoney(order.total)}, ${orderStatusLabels[order.status]}`} onClick={() => router.push(`/orders?orderId=${encodeURIComponent(order.id)}`)}><div><strong className="overview-order-list__customer">{order.customer.name}</strong><span className="overview-order-list__meta">{order.code} · {order.customer.phone}</span></div><div><em className="overview-order-list__amount">{formatMoney(order.total)}</em><Tag color={orderStatusColors[order.status]}>{orderStatusLabels[order.status]}</Tag></div></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn hàng đang mở"><Button onClick={() => router.push('/orders?create=1')}>Tạo đơn hàng</Button></Empty>}</Card><Card className="overview-panel overview-sales" title="Giá trị đơn tạo trong 7 ngày" extra={<Button type="link" onClick={() => router.push('/reports')}>Xem báo cáo</Button>}><SalesChart data={data.dailySales} /></Card></section>
      <section className="overview-quick-actions" aria-labelledby="overview-quick-actions-title"><h2 id="overview-quick-actions-title">Tạo nhanh</h2><div><Button icon={<FileTextOutlined />} onClick={() => router.push('/eye-exams?create=1')}>Tạo phiếu đo</Button><Button icon={<TeamOutlined />} onClick={() => router.push('/customers?create=1')}>Thêm khách hàng</Button></div></section>
    </> : null}
  </div>;
}
