# Hướng dẫn UI/UX — Admin Console Azure Horizon

> Tài liệu chuẩn để thiết kế giao diện cho dự án quản trị mới. Kế thừa **ngôn ngữ giao diện, cấu trúc, design system và trải nghiệm** của Azure Horizon; không kế thừa nghiệp vụ du lịch nếu không phù hợp.

## 1. Tinh thần thiết kế

- Admin console hiện đại, sạch, chuyên nghiệp, ưu tiên dữ liệu vận hành và thao tác nhanh.
- Tương phản đặc trưng: **sidebar navy tối** kết hợp vùng nội dung sáng, thoáng.
- Tránh cảm giác corporate khô cứng, lạm dụng gradient, hoặc card có bóng nặng.
- Desktop-first; nội dung chính tối đa `1400–1600px` và căn giữa trong vùng main.
- Chuyển động ngắn `200–350ms`, easing mềm; luôn hỗ trợ `prefers-reduced-motion`.

## 2. Typography, icon và hình dạng

| Hạng mục              | Chuẩn sử dụng                               |
| --------------------- | ------------------------------------------- |
| Font tiêu đề          | `Plus Jakarta Sans`, đậm, tracking hơi chặt |
| Font nội dung và bảng | `Inter`                                     |
| Icon                  | `Material Symbols Outlined`                 |
| Card, button, input   | Border radius `12–16px`                     |
| Badge/chip            | Pill, bo tròn hoàn toàn                     |
| Bóng                  | Rất nhẹ; ưu tiên viền xám nhạt              |
| Hover card            | Có thể nâng `2px` kèm shadow nhẹ            |

## 3. Design tokens

### Màu nền và chữ

| Token gợi ý        | Giá trị                  |
| ------------------ | ------------------------ |
| `--bg-page`        | `#F8FAFC` hoặc `#F9F9FF` |
| `--bg-surface`     | `#FFFFFF`                |
| `--border-subtle`  | `#E2E8F0` / slate-100    |
| `--text-primary`   | slate-800 đến slate-900  |
| `--text-secondary` | slate-500                |
| `--text-muted`     | slate-400                |
| `--sidebar-bg`     | xấp xỉ `#060E24`         |

### Màu thương hiệu và trạng thái

| Token gợi ý             | Giá trị / mục đích                                  |
| ----------------------- | --------------------------------------------------- |
| `--primary-navy`        | `#003F87`                                           |
| `--primary-blue`        | `#0056B3`                                           |
| `--blue-interactive`    | `#3B82F6` / `#2563EB`                               |
| `--brand-gradient`      | `linear-gradient(135deg, #003F87 0%, #0056B3 100%)` |
| Success                 | emerald/green                                       |
| Pending / warning       | amber                                               |
| Attention / destructive | orange/red                                          |
| Information             | blue/cyan                                           |
| Content / review        | violet/purple                                       |
| Super Admin             | amber/gold                                          |

Gradient thương hiệu chỉ dùng có chủ đích; không biến dashboard thành một màn hình nhiều gradient.

## 4. Khung ứng dụng (AppShell)

### Sidebar cố định

- Rộng `288px` (`w-72`), fixed, cao bằng viewport; nền navy rất tối, viền phải trắng 5% và shadow tối nhẹ.
- Khu logo cao `80px`: icon `explore` trong ô `32×32`, nền sky, radius `12px`; tên thương hiệu trắng; nhãn `ADMIN CONSOLE` uppercase, nhỏ, xanh nhạt mờ.
- Nhóm menu có nhãn uppercase, `10px`, letter-spacing rộng (ví dụ: **SIÊU QUẢN TRỊ**, **VẬN HÀNH**, **QUẢN TRỊ**).
- Nav item dùng icon Material `20px`, padding dọc khoảng `10px`, radius `12px`.
  - Bình thường: chữ/icon slate-400; hover nền trắng mờ.
  - Active vận hành: nền `sky-400/20`, viền sky nhạt, icon sky-300, chữ trắng.
  - Active Super Admin: nền amber mờ, viền amber, icon/chữ vàng nhạt.
- Chân sidebar là user panel: tên, badge vai trò và nút đăng xuất đỏ nhẹ.

### Top bar

- Nằm trên vùng nội dung, cao `72–80px`, nền trắng, border-bottom thật nhẹ.
- Trái: icon theo trang, tiêu đề trang và subtitle.
- Phải: đồng hồ thời gian thực (desktop lớn), shortcut/command menu, chuông có badge, avatar/profile menu.
- Notification panel là popover trắng bo lớn, hỗ trợ tab: Tất cả, Đặt tour, Hỗ trợ, Đánh giá, Khách hàng; có thể đánh dấu đã đọc.

### Main content

- Nền slate-50; padding desktop `32px`; vùng dữ liệu giới hạn `max-width: 1600px` và căn giữa.
- Hàng đầu mỗi trang gồm title, mô tả, hành động chính và hành động phụ/xuất dữ liệu.

## 5. Component phải tái sử dụng

Tối thiểu cần tách thành: `AppShell`, `Sidebar`, `TopBar`, `PageHeader`, `KpiCard`, `DataTable`, `FilterBar`, `StatusBadge`, `EmptyState`, `Modal`, `Drawer`, `Toast`.

| Component     | Quy ước                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`  | Title `24–30px`, subtitle `13–14px`, CTA chính màu xanh có icon bên trái; actions phụ outline/ghost.                                                                        |
| `KpiCard`     | Surface trắng, viền slate-100, radius 16px, padding `20–24px`; icon trong ô tint theo loại dữ liệu; label, giá trị lớn, trend và mô tả phụ. Có thể click để drill-down/lọc. |
| `StatusBadge` | Dạng pill; luôn có text cùng chấm/icon trạng thái, không chỉ dùng màu.                                                                                                      |
| `FilterBar`   | Search rộng có icon; select/chip/input radius `10–12px`; lọc trạng thái, thời gian, loại, người phụ trách; luôn có “Xóa bộ lọc”. Có thể thêm saved views/quick filters.     |
| `DataTable`   | Card trắng radius 16px, viền mảnh; header slate-50, uppercase nhỏ, tracking rộng; row có divider slate-100 và hover slate-50.                                               |
| `Drawer`      | Mở từ phải để xem chi tiết mà vẫn giữ ngữ cảnh bảng.                                                                                                                        |
| `Modal`       | Form tạo/sửa có thể dùng modal lớn hoặc full-screen workspace.                                                                                                              |
| `Toast`       | Nổi góc phải dưới, icon trạng thái và progress bar.                                                                                                                         |

## 6. Chuẩn bảng dữ liệu

- Cho phép chọn nhiều bằng checkbox, có bulk action bar, phân trang và chọn số dòng.
- Dùng avatar ảnh/chữ cái đầu khi cần; trạng thái hiển thị badge pill có chấm tròn màu.
- Giá trị tiền/số căn phải và dùng tabular numbers.
- Trên mobile phải scroll ngang hoặc chuyển sang card list; không làm mất dữ liệu cột quan trọng.
- Bắt buộc có các trạng thái: skeleton loading, empty state (icon lớn + hướng dẫn) và error state (nút thử lại).

## 7. Mẫu trang tham chiếu

### Dashboard

- Greeting/header kèm date range và refresh.
- KPI desktop gồm 4 card (ví dụ: doanh thu, booking, giá trị đơn trung bình, khách hàng mới); tablet 2 cột; mobile 1 cột.
- Hàng “việc cần xử lý”: pending, yêu cầu hủy, nội dung chờ duyệt, ticket đang mở; dùng màu nhẹ có ý nghĩa.
- Bao gồm bar chart doanh thu, donut phân bố trạng thái và bảng dữ liệu gần đây.
- Mọi vùng/card có liên kết “Xem chi tiết” khi phù hợp.

### Statistics / Analytics

- Date preset: hôm nay, 7 ngày, 30 ngày, tùy chỉnh.
- KPI, xu hướng doanh thu, phân tích theo nhóm/destination/category, trạng thái đơn, tỷ lệ hủy, top sản phẩm/dịch vụ/khách hàng/voucher.
- Khi không có dữ liệu, thay biểu đồ bằng empty state rõ ràng.

### Danh sách CRUD

Trình tự chuẩn: `PageHeader + CTA → KPI summary → tabs (nếu có) → FilterBar + bulk actions → DataTable → Drawer chi tiết / Modal form / Dialog xác nhận`.

Áp dụng cho các module như sản phẩm/dịch vụ, đơn hàng, khách hàng, nhân sự, khuyến mãi, bài viết và đánh giá. Thêm xuất CSV khi nghiệp vụ cần.

### Hỗ trợ / ticket

- Bố cục 3 cột hoặc 2 cột: danh sách ticket, hội thoại, thông tin khách hàng/ticket.
- Làm nổi trạng thái, SLA, mức ưu tiên, assignee và hoạt động gần đây.

### Cài đặt và quản trị cấp cao

- Chia setting thành các card section.
- Khi thiếu quyền, hiển thị badge `Read-only`; vẫn cho xem chi tiết nhưng không có thao tác cập nhật.
- Super Admin dùng amber accent để phân biệt quyền cao; có trạng thái hệ thống, audit log và phân quyền.

## 8. Phân quyền trong UI

| Vai trò       | Phạm vi giao diện                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `SUPER_ADMIN` | Khu Siêu quản trị, nhân sự, action logs, cấu hình hệ thống và màn vận hành được cấp quyền.       |
| `ADMIN`       | Dashboard, thống kê, CRUD nghiệp vụ, marketing, cài đặt, nhân viên, logs.                        |
| `STAFF`       | Dashboard công việc và module được giao như nội dung, đơn hàng, khách hàng, voucher hoặc hỗ trợ. |

Phân quyền áp dụng cả cho menu, CTA, bulk action và thao tác nguy hiểm — không chỉ khóa API. Với quyền đọc, giữ màn hình chi tiết nhưng ẩn hoặc disable hành động thay đổi.

## 9. Responsive và accessibility

- Desktop: sidebar cố định. Tablet/mobile: sidebar trở thành drawer qua nút menu; top bar thu gọn.
- Mọi button/icon cần tooltip (nếu chỉ có icon) và `aria-label`.
- Focus ring xanh rõ ràng.
- Không truyền đạt trạng thái chỉ bằng màu: thêm nhãn text và icon/chấm.
- Tôn trọng reduced motion.

## 10. Checklist trước khi dựng màn hình mới

- [ ] Dùng AppShell và component sẵn có, không tự tạo biến thể rời rạc.
- [ ] Sidebar navy tối, main sáng, bảng dữ liệu dễ đọc và khoảng trắng hợp lý.
- [ ] CTA chính là xanh; hành động phụ outline/ghost; destructive là đỏ.
- [ ] Accent amber chỉ dành cho ngữ cảnh quyền cao/Super Admin.
- [ ] Có loading, empty, error, hover, focus và trạng thái disabled/read-only.
- [ ] Đã kiểm tra vai trò và responsive table/drawer.
- [ ] Nếu dùng React/Next.js: ưu tiên Tailwind CSS, Inter + Plus Jakarta Sans và Material Symbols.

## 11. Thứ tự khởi tạo khuyến nghị

1. Khai báo tokens (màu, typography, radius, shadow, motion).
2. Dựng `AppShell`, `Sidebar`, `TopBar` và xử lý responsive sidebar.
3. Tạo primitives/button/input/badge/card rồi các component tái sử dụng.
4. Dựng dashboard mẫu để chốt spacing, KPI, biểu đồ, bảng và empty/loading states.
5. Mở rộng theo template CRUD, ticket và settings; gắn quyền hiển thị ngay từ đầu.
