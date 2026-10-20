'use client';

import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Space,
  Spin,
  Typography,
  message,
  type MenuProps,
} from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { getErrorMessage, useLogoutMutation, useMeQuery } from '@/store/api';

const { Header, Sider, Content } = Layout;

const navigation: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng' },
  { key: '/eye-exams', icon: <FileTextOutlined />, label: 'Đơn kính' },
  { key: '/orders', icon: <ShoppingOutlined />, label: 'Đơn hàng' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Sản phẩm & Kho' },
  { key: '/inventory-history', icon: <HistoryOutlined />, label: 'Lịch sử kho' },
  { key: '/reminders', icon: <CalendarOutlined />, label: 'Nhắc tái khám' },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
];

function NavigationMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname.startsWith('/customers') ? '/customers' : pathname;
  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selected]}
      items={navigation}
      onClick={({ key }) => {
        router.push(key);
        onNavigate?.();
      }}
    />
  );
}

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { data: user, isLoading } = useMeQuery();
  const [logout] = useLogoutMutation();
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogout = async (): Promise<void> => {
    try {
      await logout().unwrap();
      router.replace('/login');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const profileItems: MenuProps['items'] = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];
  if (isLoading)
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Sider
        breakpoint="md"
        collapsedWidth="0"
        width={288}
        theme="dark"
        style={{ background: '#060e24' }}
      >
        <div style={{ height: 80, padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <div className="app-logo">
            <span className="app-logo__mark">
              <CustomerServiceOutlined />
            </span>
            <span>Kính mắt Admin</span>
          </div>
        </div>
        <NavigationMenu />
      </Sider>
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        styles={{ body: { padding: 0, background: '#060e24' } }}
        width={288}
        closable={false}
      >
        <div style={{ height: 80, padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <div className="app-logo">
            <span className="app-logo__mark">
              <CustomerServiceOutlined />
            </span>
            <span>Kính mắt Admin</span>
          </div>
        </div>
        <NavigationMenu onNavigate={() => setMobileOpen(false)} />
      </Drawer>
      <Layout>
        <Header className="dashboard-header">
          <Button
            className="mobile-menu"
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          />
          <Typography.Text type="secondary">Quản trị cửa hàng</Typography.Text>
          <Space size="middle">
            <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Thông báo" />
            <Dropdown
              menu={{
                items: profileItems,
                onClick: ({ key }) => key === 'logout' && void handleLogout(),
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: '#0056b3' }}>
                  {user?.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Typography.Text>{user?.name}</Typography.Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ background: '#f8fafc' }}>
          <main className="page-content">{children}</main>
        </Content>
      </Layout>
    </Layout>
  );
}
