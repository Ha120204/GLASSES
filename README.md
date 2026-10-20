# Kính mắt Admin

Hệ thống quản trị cho một cửa hàng kính mắt, gồm Next.js + Ant Design ở frontend và NestJS + Prisma/PostgreSQL ở backend.

## Yêu cầu

- Node.js **22 LTS** (dự án ghim `>=22 <24` để tương thích Prisma 6)
- pnpm 9+
- Docker Desktop (chỉ để chạy PostgreSQL local)

## Chạy local

1. Tạo file môi trường từ mẫu:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   Trên PowerShell dùng `Copy-Item` thay cho `cp`. Đổi `JWT_SECRET`, `SEED_EMAIL` và `SEED_PASSWORD` trước khi chạy ở môi trường thật.

2. Khởi động PostgreSQL:

   ```bash
   docker compose up -d
   ```

   PostgreSQL của project được mở ở cổng host `5433` để tránh xung đột với dịch vụ PostgreSQL đang dùng cổng `5432`.

3. Cài packages, áp dụng migration, sinh Prisma Client và tạo tài khoản chủ. Nếu máy chưa có lệnh `pnpm`, thay `pnpm` bằng `corepack pnpm` trong các lệnh sau:

   ```bash
   pnpm install
   pnpm --filter @glasses/api prisma:generate
   pnpm --filter @glasses/api prisma migrate deploy
   pnpm --filter @glasses/api prisma:seed
   ```

4. Chạy hai ứng dụng:

   ```bash
   pnpm dev
   ```

Mở `http://localhost:3000`, rồi đăng nhập bằng `SEED_EMAIL` / `SEED_PASSWORD`.

## Kiểm tra nhanh

- `GET http://localhost:4000/api/health` trả về trạng thái `ok`.
- Đăng nhập từ `/login`; cookie `access_token` là httpOnly và cùng origin qua Next.js rewrite `/api/*`.
- Vào **Khách hàng** để thêm, sửa, tìm theo tên/số điện thoại, xóa mềm, phân trang và xem trang chi tiết.
- Chạy kiểm tra source: `pnpm build` và `pnpm lint`.

## Deploy

- **API (Railway/Render):** dùng [apps/api/Dockerfile](apps/api/Dockerfile). Khai báo `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`; entrypoint tự chạy `prisma migrate deploy` trước khi khởi động API.
- **Web (Vercel):** đặt Root Directory là `apps/web` và khai báo `API_URL` trỏ tới base URL của API. Rewrite giữ cookie cùng origin cho trình duyệt.

Không commit các tệp `.env`; chúng đã được loại trừ bởi `.gitignore`.
