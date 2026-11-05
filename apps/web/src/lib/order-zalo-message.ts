import type { Order, StoreSetting } from '@/store/api';

export function createOrderZaloMessage(
  order: Order,
  setting?: Pick<StoreSetting, 'storeName' | 'phone'>,
): string {
  const storeName = setting?.storeName?.trim() || 'Cửa hàng kính mắt';
  const storePhone = setting?.phone?.trim();
  const dueDate = order.dueDate
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(order.dueDate))
    : null;

  return [
    `${storeName} xác nhận đã nhận đơn đặt kính ${order.code} của ${order.customer.name}.`,
    dueDate
      ? `Ngày hẹn lấy kính (dự kiến): ${dueDate}.`
      : 'Cửa hàng sẽ báo khi kính sẵn sàng để nhận.',
    'Khi đến, vui lòng cho xem mã đơn này hoặc đọc số điện thoại đã đặt.',
    storePhone ? `Liên hệ cửa hàng: ${storePhone}.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
