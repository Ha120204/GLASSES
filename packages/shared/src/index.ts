export enum ProductType {
  FRAME = 'FRAME',
  LENS = 'LENS',
  CONTACT = 'CONTACT',
  ACCESSORY = 'ACCESSORY',
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUST = 'ADJUST',
}

export enum OrderStatus {
  NEW = 'NEW',
  LENS_ORDERED = 'LENS_ORDERED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: 'Mới',
  [OrderStatus.LENS_ORDERED]: 'Đã đặt tròng',
  [OrderStatus.PROCESSING]: 'Đang gia công',
  [OrderStatus.READY]: 'Sẵn sàng giao',
  [OrderStatus.DELIVERED]: 'Đã giao',
  [OrderStatus.CANCELLED]: 'Đã hủy',
};

export const productTypeLabels: Record<ProductType, string> = {
  [ProductType.FRAME]: 'Gọng kính',
  [ProductType.LENS]: 'Tròng kính',
  [ProductType.CONTACT]: 'Kính áp tròng',
  [ProductType.ACCESSORY]: 'Phụ kiện',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Tiền mặt',
  [PaymentMethod.TRANSFER]: 'Chuyển khoản',
};

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EyeExamValues {
  rSph: number | null;
  rCyl: number | null;
  rAxis: number | null;
  rAdd: number | null;
  rPd: number | null;
  lSph: number | null;
  lCyl: number | null;
  lAxis: number | null;
  lAdd: number | null;
  lPd: number | null;
}

export const formatDiopter = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

export const formatAxis = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${value}°`;

export const formatRx = (
  sph: number | null | undefined,
  cyl: number | null | undefined,
  axis: number | null | undefined,
): string => {
  if (sph === null || sph === undefined) return '—';
  const cylText = cyl === null || cyl === undefined ? '' : ` / ${formatDiopter(cyl)}`;
  const axisText = cyl !== null && cyl !== undefined && cyl !== 0 && axis !== null && axis !== undefined ? ` x ${formatAxis(axis)}` : '';
  return `${formatDiopter(sph)}${cylText}${axisText}`;
};

export const formatRxDifference = (before: number | null, after: number | null): string => {
  if (before === null || after === null) return '—';
  const difference = after - before;
  return difference === 0 ? 'Không đổi' : `${difference > 0 ? '+' : ''}${difference.toFixed(2)}`;
};
