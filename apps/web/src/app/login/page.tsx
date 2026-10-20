'use client';

import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import { getErrorMessage, useLoginMutation } from '@/store/api';

interface LoginValues {
  email: string;
  password: string;
}

const highlights = ['Hồ sơ khách hàng tập trung', 'Phiếu đo và lịch tái khám', 'Quản lý sản phẩm, kho hàng'];

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [messageApi, contextHolder] = message.useMessage();

  const submit = async (values: LoginValues): Promise<void> => {
    try {
      await login(values).unwrap();
      messageApi.success('Đăng nhập thành công.');
      router.replace('/');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  return (
    <main className="login-page">
      {contextHolder}
      <div className="login-page__glow login-page__glow--top" aria-hidden />
      <div className="login-page__glow login-page__glow--bottom" aria-hidden />
      <section className="login-showcase" aria-label="Giới thiệu hệ thống">
        <div className="login-brand">
          <span className="login-brand__mark" aria-hidden>◎</span>
          <span>Kính mắt <b>Admin</b></span>
        </div>
        <div className="login-showcase__content">
          <span className="login-showcase__eyebrow">VẬN HÀNH THÔNG MINH</span>
          <h1>Một nơi để<br /><em>chăm sóc</em> khách hàng.</h1>
          <p>Theo dõi hành trình từ đo mắt, tư vấn sản phẩm đến chăm sóc sau bán một cách rõ ràng và nhất quán.</p>
          <ul>
            {highlights.map((highlight) => <li key={highlight}><span className="login-check" aria-hidden>✓</span>{highlight}</li>)}
          </ul>
        </div>
        <p className="login-showcase__footer">Hệ thống quản trị nội bộ · Bảo mật dữ liệu khách hàng</p>
      </section>
      <section className="login-form-panel" aria-label="Đăng nhập">
        <div className="login-form-panel__inner">
          <div className="login-brand login-brand--mobile">
            <span className="login-brand__mark" aria-hidden>◎</span>
            <span>Kính mắt <b>Admin</b></span>
          </div>
          <div className="login-form-heading">
            <span>CHÀO MỪNG TRỞ LẠI</span>
            <Typography.Title level={2}>Đăng nhập</Typography.Title>
            <Typography.Paragraph>Nhập thông tin tài khoản để tiếp tục quản lý cửa hàng.</Typography.Paragraph>
          </div>
          <Form<LoginValues> layout="vertical" onFinish={submit} requiredMark={false} className="login-form">
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email.' },
                { type: 'email', message: 'Email không hợp lệ.' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="name@cuahang.com" size="large" autoComplete="email" autoFocus />
            </Form.Item>
            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu" size="large" autoComplete="current-password" />
            </Form.Item>
            <Button className="login-submit" type="primary" htmlType="submit" size="large" loading={isLoading} block>
              <span>Đăng nhập</span><span className="login-submit__arrow" aria-hidden>→</span>
            </Button>
          </Form>
          <div className="login-form-note">
            <span className="login-note-icon" aria-hidden>i</span>
            <span>Dùng tài khoản đã được cấu hình trong hệ thống.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
