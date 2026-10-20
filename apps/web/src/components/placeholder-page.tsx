import { InboxOutlined } from '@ant-design/icons';
import { Card, Empty } from 'antd';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <Card className="surface-card">
        <Empty
          image={<InboxOutlined style={{ fontSize: 42, color: '#94a3b8' }} />}
          description="Chức năng đang được phát triển."
        />
      </Card>
    </>
  );
}
