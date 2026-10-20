import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/store/providers';

export const metadata: Metadata = {
  title: 'Kính mắt Admin',
  description: 'Quản trị cửa hàng kính mắt',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
