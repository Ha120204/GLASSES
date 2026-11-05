'use client';

import {
  AppstoreOutlined,
  BarChartOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DownOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  Menu,
  Spin,
  message,
  type MenuProps,
} from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { canLeaveSettings } from '@/lib/settings-navigation';
import { getErrorMessage, useLogoutMutation, useMeQuery } from '@/store/api';

const { Header, Sider, Content } = Layout;

const pageTitleForPath = (pathname: string): string => {
  if (pathname.startsWith('/customers')) return 'Khách hàng';
  if (pathname.startsWith('/eye-exams')) return 'Phiếu đo mắt';
  if (pathname.startsWith('/orders')) return 'Đơn hàng';
  if (pathname.startsWith('/products')) return 'Sản phẩm';
  if (pathname.startsWith('/reports')) return 'Báo cáo';
  if (pathname.startsWith('/settings')) return 'Cài đặt';
  return 'Tổng quan';
};

const navigation: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  {
    type: 'group',
    label: 'Bán hàng',
    children: [
      { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng' },
      { key: '/eye-exams', icon: <FileTextOutlined />, label: 'Phiếu đo mắt' },
      { key: '/orders', icon: <ShoppingOutlined />, label: 'Đơn hàng' },
    ],
  },
  {
    type: 'group',
    label: 'Hàng hóa',
    children: [
      { key: '/products', icon: <AppstoreOutlined />, label: 'Sản phẩm' },
    ],
  },
  {
    type: 'group',
    label: 'Vận hành',
    children: [
      { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
      { key: '/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
    ],
  },
];

function NavigationMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname.startsWith('/customers') ? '/customers' : pathname;
  return (
    <Menu
      className="dashboard-navigation"
      theme="dark"
      mode="inline"
      aria-label="Điều hướng quản trị"
      selectedKeys={[selected]}
      items={navigation}
      onClick={({ key }) => {
        if (key !== pathname && !canLeaveSettings()) return;
        router.push(key);
      }}
    />
  );
}

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useMeQuery();
  const [logout] = useLogoutMutation();
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogout = async (): Promise<void> => {
    if (!canLeaveSettings()) return;
    try {
      await logout().unwrap();
      router.replace('/login');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const roleLabel = 'Quản trị viên';
  const profileItems: MenuProps['items'] = [
    {
      key: 'profile-summary',
      disabled: true,
      label: <span className="dashboard-profile-menu__summary"><strong>{user?.name ?? 'Tài khoản'}</strong><small>{roleLabel}</small></span>,
    },
    { type: 'divider' },
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
            <span>Kính mắt Hướng Anh</span>
          </div>
        </div>
        <NavigationMenu />
      </Sider>
      <Layout>
        <Header className="dashboard-header">
          <div className="dashboard-header__context">
            <span>TRANG QUẢN TRỊ</span>
            <strong>{pageTitleForPath(pathname)}</strong>
          </div>
          <Dropdown
            menu={{
              items: profileItems,
              onClick: ({ key }) => key === 'logout' && void handleLogout(),
            }}
            trigger={['click']}
          >
            <Button className="dashboard-profile" type="text" aria-label="Mở menu tài khoản">
              <Avatar size={36}>{user?.name.slice(0, 1).toUpperCase()}</Avatar>
              <span className="dashboard-profile__identity"><strong>{user?.name ?? 'Tài khoản'}</strong><small>{roleLabel}</small></span>
              <DownOutlined />
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ background: '#f8fafc' }}>
          <main className="page-content">{children}</main>
        </Content>
      </Layout>
    </Layout>
  );
}
