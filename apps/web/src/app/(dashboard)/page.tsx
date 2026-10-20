'use client';

import {
  ArrowUpOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Empty, Row, Statistic, Tag, Typography } from 'antd';

const cards = [
  { title: 'Doanh thu tháng', value: 0, prefix: <DollarOutlined />, color: '#e0f2fe' },
  { title: 'Đơn kính mới', value: 0, prefix: <ShoppingCartOutlined />, color: '#dcfce7' },
  { title: 'Khách hàng mới', value: 0, prefix: <TeamOutlined />, color: '#f3e8ff' },
  { title: 'Đơn chờ xử lý', value: 0, prefix: <ClockCircleOutlined />, color: '#fef3c7' },
];

export default function DashboardPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tổng quan</h1>
          <p>Theo dõi nhanh hoạt động cửa hàng kính mắt.</p>
        </div>
        <Tag color="blue">Hôm nay</Tag>
      </div>
      <Row gutter={[20, 20]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} xl={6} key={card.title}>
            <Card className="stat-card">
              <Statistic
                title={card.title}
                value={card.value}
                prefix={
                  <span
                    style={{
                      display: 'inline-grid',
                      placeItems: 'center',
                      width: 32,
                      height: 32,
                      marginRight: 8,
                      borderRadius: 10,
                      background: card.color,
                    }}
                  >
                    {card.prefix}
                  </span>
                }
                suffix={card.title.includes('Doanh thu') ? '₫' : ''}
              />
              <Typography.Text type="secondary">
                <ArrowUpOutlined style={{ color: '#16a34a' }} /> Chưa có dữ liệu kỳ này
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={14}>
          <Card className="surface-card" title="Doanh thu gần đây">
            <Empty description="Dữ liệu doanh thu sẽ hiển thị khi có đơn hàng." />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="surface-card" title="Việc cần xử lý">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không có công việc cần xử lý"
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
