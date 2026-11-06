import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthday: string | null;
  gender: string | null;
  address: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  birthday?: string;
  gender?: string;
  address?: string;
  note?: string;
}

export interface CustomerImportRow {
  row: number;
  name: string;
  phone: string;
  birthday?: string;
  gender?: string;
  address?: string;
  note?: string;
}
export interface CustomerImportIssue {
  row: number;
  reason: string;
  name: string;
  phone: string;
  field: 'name' | 'phone' | 'birthday' | 'gender' | 'address' | 'note';
  value: string;
}
export interface CustomerImportPreview {
  total: number;
  validRows: CustomerImportRow[];
  issues: CustomerImportIssue[];
}
export interface CustomerImportResult { created: number; updated: number; skipped: number; }

export interface CustomerDetail extends Customer {
  eyeExams: EyeExam[];
  latestEyeExam: EyeExam | null;
  ordersTotal: number;
  orders: Array<{ id: string; code: string; status: OrderStatus; total: number; createdAt: string; archivedAt: string | null; items: Array<{ name: string; qty: number }> }>;
}

export interface EyeExam {
  id: string; code: string; customerId: string; examDate: string; examiner: string | null; note: string | null; createdAt: string; lockedAt: string | null; archivedAt: string | null; pdTotal: number | null; wearingPurpose: string | null; lensDesign: string | null; noPrescription: boolean; noPrescriptionReason: string | null;
  rSph: number | null; rCyl: number | null; rAxis: number | null; rAdd: number | null; rPd: number | null; rPrism: number | null; rBase: PrismBase | null; rSegHeight: number | null;
  lSph: number | null; lCyl: number | null; lAxis: number | null; lAdd: number | null; lPd: number | null; lPrism: number | null; lBase: PrismBase | null; lSegHeight: number | null;
  ordersCount?: number;
  customer?: { id: string; name: string; phone: string; birthday?: string | null; address?: string | null };
  setting?: { storeName: string; address: string | null; phone: string | null; invoiceTemplate: string | null } | null;
}
export type EyeExamStatusFilter = 'DRAFT' | 'LOCKED';
export type EyeExamSortBy = 'examDate' | 'customerName' | 'status';
export interface EyeExamListQuery { customerId?: string; q?: string; dateFrom?: string; dateTo?: string; status?: EyeExamStatusFilter; sortBy?: EyeExamSortBy; sortDirection?: 'asc' | 'desc'; page: number; pageSize: number; }
export interface EyeExamImportRow { row: number; code?: string; phone: string; examDate: string; rSph?: number; rCyl?: number; rAxis?: number; rAdd?: number; rPd?: number; rPrism?: number; rBase?: PrismBase; rSegHeight?: number; lSph?: number; lCyl?: number; lAxis?: number; lAdd?: number; lPd?: number; lPrism?: number; lBase?: PrismBase; lSegHeight?: number; pdTotal?: number; wearingPurpose?: string; lensDesign?: string; noPrescription: boolean; noPrescriptionReason?: string; note?: string; }
export interface EyeExamImportIssue { row: number; reason: string; kind?: 'existing'; }
export interface EyeExamImportPreview { total: number; validRows: EyeExamImportRow[]; issues: EyeExamImportIssue[]; }
export interface EyeExamImportResult { created: number; skipped: number; }
export type PrismBase = 'BI' | 'BO' | 'BU' | 'BD';
export type EyeExamAuditAction = 'CREATED' | 'UPDATED' | 'LOCKED' | 'UNLOCKED' | 'ARCHIVED' | 'RESTORED';
export interface EyeExamAuditEntry {
  id: string;
  action: EyeExamAuditAction;
  changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }> | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}
export interface EyeExamInput { customerId: string; examDate: string; note?: string; pdTotal?: number | null; wearingPurpose?: string | null; lensDesign?: string | null; noPrescription?: boolean; noPrescriptionReason?: string | null; rSph?: number | null; rCyl?: number | null; rAxis?: number | null; rAdd?: number | null; rPd?: number | null; rPrism?: number | null; rBase?: PrismBase | null; rSegHeight?: number | null; lSph?: number | null; lCyl?: number | null; lAxis?: number | null; lAdd?: number | null; lPd?: number | null; lPrism?: number | null; lBase?: PrismBase | null; lSegHeight?: number | null; }
export type EyeExamCreateInput = EyeExamInput & { idempotencyKey: string };
export interface StoreSetting {
  id: string;
  storeName: string;
  address: string | null;
  phone: string | null;
  invoiceTemplate: string | null;
  qrPaymentEnabled: boolean;
  bankName: string | null;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  transferContentPrefix: string;
}
export interface StoreSettingInput {
  storeName?: string;
  address?: string | null;
  phone?: string | null;
  invoiceTemplate?: string | null;
  qrPaymentEnabled?: boolean;
  bankName?: string | null;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  transferContentPrefix?: string;
}
export type ProductType = 'FRAME' | 'LENS' | 'CONTACT' | 'ACCESSORY';
export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  type: ProductType;
  brand: string | null;
  costPrice: number;
  salePrice: number;
  supplier: string | null;
  active: boolean;
  deletedAt: string | null;
  imageUpdatedAt: string | null;
}
export interface ProductInput {
  sku: string;
  autoSku?: boolean;
  idempotencyKey?: string;
  barcode?: string | null;
  name: string;
  type: ProductType;
  brand?: string | null;
  costPrice: number;
  salePrice: number;
  supplier?: string | null;
  active?: boolean;
}
export interface ProductImportRow {
  row: number;
  sku?: string;
  name: string;
  type: ProductType;
  brand?: string;
  barcode?: string;
  costPrice: number;
  salePrice: number;
  supplier?: string;
  active: boolean;
}
export interface ProductImportIssue { row: number; reason: string; }
export interface ProductImportPreview { total: number; validRows: ProductImportRow[]; issues: ProductImportIssue[]; }
export interface ProductImportResult { created: number; updated: number; skipped: number; }
export type OrderStatus = 'IN_PROGRESS' | 'AWAITING_PAYMENT' | 'DELIVERED' | 'CANCELLED';
export type OrderType = 'PREORDER' | 'READY_SALE';
export type OrderWorkFilter = 'IN_PROGRESS' | 'TODAY' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'TRANSFER';
export type PaymentType = 'PAYMENT' | 'REFUND';
export type UserRole = 'ADMIN';
export const paymentMethodLabels: Record<PaymentMethod, string> = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản' };
export interface OrderStatusCounts {
  total: number;
  byStatus: Record<OrderStatus, number>;
  work: { outstanding: number; inProgress: number; today: number; overdue: number };
}
export interface ReportOverview {
  period: { dateFrom: string; dateTo: string };
  summary: { orderSales: number; collected: number; outstanding: number; orderCount: number; inProgress: number };
  dailySales: Array<{ date: string; sales: number; orders: number }>;
  statusCounts: Record<OrderStatus, number>;
  paymentByMethod: Record<PaymentMethod, number>;
  topProducts: Array<{ name: string; qty: number; sales: number }>;
}
export interface DashboardOverview {
  today: string;
  summary: { collectedToday: number; completedToday: number; outstanding: number; inProgress: number };
  tasks: { overdue: number; dueToday: number; inProgress: number };
  recentOrders: Array<{ id: string; code: string; status: OrderStatus; total: number; dueDate: string | null; createdAt: string; customer: { name: string; phone: string } }>;
  dailySales: Array<{ date: string; sales: number }>;
}
export const orderStatusLabels: Record<OrderStatus, string> = {
  IN_PROGRESS: 'Đang thực hiện',
  AWAITING_PAYMENT: 'Chờ thanh toán QR',
  DELIVERED: 'Đã giao · hoàn tất',
  CANCELLED: 'Đã hủy',
};
export const orderTypeLabels: Record<OrderType, string> = { PREORDER: 'Đơn đặt trước / hẹn lấy', READY_SALE: 'Bán và giao ngay' };
export const orderStatusColors: Record<OrderStatus, string> = {
  IN_PROGRESS: 'blue',
  AWAITING_PAYMENT: 'gold',
  DELIVERED: 'green',
  CANCELLED: 'default',
};
export type OrderProduct = Pick<
  Product,
  'id' | 'sku' | 'name' | 'type' | 'brand' | 'salePrice' | 'active' | 'imageUpdatedAt'
>;

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  qty: number;
  product: OrderProduct | null;
}
export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  type: PaymentType;
  paidAt: string;
  note: string | null;
  reference: string | null;
  createdBy: { id: string; name: string } | null;
}
export interface PrescriptionSnapshot {
  sourceEyeExamId: string;
  examDate: string;
  pdTotal: number | null;
  wearingPurpose: string | null;
  lensDesign: string | null;
  noPrescription: boolean;
  noPrescriptionReason: string | null;
  rSph: number | null; rCyl: number | null; rAxis: number | null; rAdd: number | null; rPd: number | null; rPrism: number | null; rBase: PrismBase | null; rSegHeight: number | null;
  lSph: number | null; lCyl: number | null; lAxis: number | null; lAdd: number | null; lPd: number | null; lPrism: number | null; lBase: PrismBase | null; lSegHeight: number | null;
}
export interface Order {
  id: string;
  code: string;
  customerId: string;
  eyeExamId: string | null;
  prescriptionSnapshot: PrescriptionSnapshot | null;
  orderType: OrderType;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
  outstandingAmount: number;
  depositMethod: PaymentMethod | null;
  dueDate: string | null;
  warrantyUntil: string | null;
  note: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  refundPendingAmount: number;
  refundMethod: PaymentMethod | null;
  refundBankName: string | null;
  refundAccountNumber: string | null;
  refundAccountName: string | null;
  archivedAt: string | null;
  archivedById: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string; address: string | null };
  createdBy: { id: string; name: string } | null;
  archivedBy: { id: string; name: string } | null;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: Array<{ id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; createdAt: string; createdBy: { id: string; name: string } | null }>;
  auditLogs?: Array<{
    id: string;
    action: 'UPDATED' | 'ARCHIVED' | 'RESTORED';
    changes: Record<string, unknown> | null;
    createdAt: string;
    createdBy: { id: string; name: string } | null;
  }>;
}
export interface OrderInput {
  idempotencyKey?: string;
  orderType?: OrderType;
  customerId: string;
  eyeExamId?: string | null;
  items: Array<{ productId: string; qty: number }>;
  discount?: number;
  deposit?: number;
  depositMethod?: PaymentMethod;
  awaitingTransferPayment?: boolean;
  dueDate?: string | null;
  warrantyUntil?: string | null;
  note?: string | null;
}
export type OrderUpdateInput = Omit<OrderInput, 'idempotencyKey' | 'deposit' | 'depositMethod' | 'orderType' | 'awaitingTransferPayment'>;
interface EyeExamList { items: EyeExam[]; total: number; page: number; pageSize: number; }

interface CustomerList {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}
export interface CustomerListQuery {
  q?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  sortBy?: 'createdAt' | 'name' | 'phone';
  sortDirection?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}
interface OrderList {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
interface LoginInput {
  email: string;
  password: string;
}
interface ApiError {
  data?: { message?: string | string[] };
  status?: number | string;
}

export const getErrorMessage = (error: unknown): string => {
  const apiError = error && typeof error === 'object' ? error as ApiError : {};
  const message = apiError.data && typeof apiError.data === 'object' ? apiError.data.message : undefined;
  if (Array.isArray(message)) return message[0] ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
  if (typeof message === 'string') return message;
  if (apiError.status === 'FETCH_ERROR') return 'Không kết nối được máy chủ. Vui lòng thử lại.';
  if (apiError.status === 'PARSING_ERROR') return 'Máy chủ trả về dữ liệu không hợp lệ. Vui lòng tải lại trang và thử lại.';
  return 'Có lỗi xảy ra. Vui lòng thử lại.';
};

const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api', credentials: 'include' });
let sessionRedirect: Promise<void> | null = null;

const baseQueryWithSessionExpiry: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && api.endpoint !== 'login' && typeof window !== 'undefined') {
    sessionRedirect ??= (async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
      window.location.replace('/login?expired=1');
    })();
    await sessionRedirect;
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithSessionExpiry,
  tagTypes: ['Customer', 'Auth', 'EyeExam', 'Setting', 'Product', 'Order'],
  endpoints: (builder) => ({
    login: builder.mutation<{ user: User }, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    me: builder.query<User, void>({ query: () => '/auth/me', providesTags: ['Auth'] }),
    customers: builder.query<CustomerList, CustomerListQuery>({
      query: (params) => ({ url: '/customers', params }),
      providesTags: ['Customer'],
    }),
    deletedCustomers: builder.query<CustomerList, { q?: string; page: number; pageSize: number }>({
      query: (params) => ({ url: '/customers/trash', params }),
      providesTags: ['Customer'],
    }),
    customer: builder.query<CustomerDetail, string>({
      query: (id) => `/customers/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: builder.mutation<Customer, CustomerInput>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    previewCustomerImport: builder.mutation<CustomerImportPreview, FormData>({
      query: (body) => ({ url: '/customers/import/preview', method: 'POST', body }),
    }),
    importCustomers: builder.mutation<CustomerImportResult, { rows: CustomerImportRow[] }>({
      query: (body) => ({ url: '/customers/import', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: string; data: CustomerInput }>({
      query: ({ id, data }) => ({ url: `/customers/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Customer'],
    }),
    restoreCustomer: builder.mutation<Customer, string>({
      query: (id) => ({ url: `/customers/${id}/restore`, method: 'PATCH' }),
      invalidatesTags: ['Customer'],
    }),
    permanentlyDeleteCustomer: builder.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}/permanent`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
    bulkDeleteCustomers: builder.mutation<{ count: number }, string[]>({
      query: (ids) => ({ url: '/customers/bulk-delete', method: 'POST', body: { ids } }),
      invalidatesTags: ['Customer'],
    }),
    eyeExams: builder.query<EyeExamList, EyeExamListQuery>({ query: (params) => ({ url: '/eye-exams', params }), providesTags: ['EyeExam'] }),
    archivedEyeExams: builder.query<EyeExamList, EyeExamListQuery>({ query: (params) => ({ url: '/eye-exams/archive', params }), providesTags: ['EyeExam'] }),
    previewEyeExamImport: builder.mutation<EyeExamImportPreview, FormData>({ query: (body) => ({ url: '/eye-exams/import/preview', method: 'POST', body }) }),
    importEyeExams: builder.mutation<EyeExamImportResult, { rows: EyeExamImportRow[] }>({ query: (body) => ({ url: '/eye-exams/import', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
    eyeExam: builder.query<EyeExam, string>({ query: (id) => `/eye-exams/${id}`, providesTags: (_r, _e, id) => [{ type: 'EyeExam', id }] }),
    eyeExamHistory: builder.query<EyeExamAuditEntry[], string>({ query: (id) => `/eye-exams/${id}/history`, providesTags: (_r, _e, id) => [{ type: 'EyeExam', id }] }),
    customerEyeExams: builder.query<EyeExam[], string>({ query: (id) => `/customers/${id}/eye-exams`, providesTags: (_r, _e, id) => [{ type: 'EyeExam', id }] }),
    createEyeExam: builder.mutation<EyeExam, EyeExamCreateInput>({ query: (body) => ({ url: '/eye-exams', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
    finalizeEyeExam: builder.mutation<EyeExam, EyeExamCreateInput>({ query: (body) => ({ url: '/eye-exams/finalize', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
    updateEyeExam: builder.mutation<EyeExam, { id: string; data: Partial<EyeExamInput> }>({ query: ({ id, data }) => ({ url: `/eye-exams/${id}`, method: 'PATCH', body: data }), invalidatesTags: ['EyeExam', 'Customer'] }),
    finalizeExistingEyeExam: builder.mutation<EyeExam, { id: string; data: Partial<EyeExamInput> }>({ query: ({ id, data }) => ({ url: `/eye-exams/${id}/finalize`, method: 'PATCH', body: data }), invalidatesTags: ['EyeExam', 'Customer'] }),
    lockEyeExam: builder.mutation<EyeExam, string>({ query: (id) => ({ url: `/eye-exams/${id}/lock`, method: 'PATCH' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    unlockEyeExam: builder.mutation<EyeExam, string>({ query: (id) => ({ url: `/eye-exams/${id}/unlock`, method: 'PATCH' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    archiveEyeExam: builder.mutation<void, string>({ query: (id) => ({ url: `/eye-exams/${id}`, method: 'DELETE' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    bulkArchiveEyeExams: builder.mutation<{ count: number }, string[]>({
      query: (ids) => ({ url: '/eye-exams/bulk-archive', method: 'POST', body: { ids } }),
      invalidatesTags: ['EyeExam', 'Customer'],
    }),
    restoreEyeExam: builder.mutation<EyeExam, string>({ query: (id) => ({ url: `/eye-exams/${id}/restore`, method: 'PATCH' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    permanentlyDeleteEyeExam: builder.mutation<void, string>({ query: (id) => ({ url: `/eye-exams/${id}/permanent`, method: 'DELETE' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    setting: builder.query<StoreSetting, void>({ query: () => '/settings', providesTags: ['Setting'] }),
    updateSetting: builder.mutation<StoreSetting, StoreSettingInput>({ query: (body) => ({ url: '/settings', method: 'PATCH', body }), invalidatesTags: ['Setting', 'EyeExam'] }),
    products: builder.query<ProductList, { q?: string; type?: ProductType; sortBy?: 'name' | 'salePrice' | 'costPrice'; sortDirection?: 'asc' | 'desc'; page: number; pageSize: number }>({
      query: (params) => ({ url: '/products', params }),
      providesTags: ['Product'],
    }),
    deletedProducts: builder.query<ProductList, { q?: string; page: number; pageSize: number }>({
      query: (params) => ({ url: '/products/trash', params }),
      providesTags: ['Product'],
    }),
    nextProductSku: builder.query<{ sku: string }, ProductType>({
      query: (type) => ({ url: '/products/next-sku', params: { type } }),
    }),
    previewProductImport: builder.mutation<ProductImportPreview, FormData>({
      query: (body) => ({ url: '/products/import/preview', method: 'POST', body }),
    }),
    importProducts: builder.mutation<ProductImportResult, { rows: ProductImportRow[] }>({
      query: (body) => ({ url: '/products/import', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),
    product: builder.query<Product, string>({ query: (id) => `/products/${id}`, providesTags: (_result, _error, id) => [{ type: 'Product', id }] }),
    createProduct: builder.mutation<Product, ProductInput>({ query: (body) => ({ url: '/products', method: 'POST', body }), invalidatesTags: ['Product'] }),
    updateProduct: builder.mutation<Product, { id: string; data: Partial<ProductInput> }>({ query: ({ id, data }) => ({ url: `/products/${id}`, method: 'PATCH', body: data }), invalidatesTags: ['Product'] }),
    uploadProductImage: builder.mutation<Product, { id: string; file: File }>({
      query: ({ id, file }) => {
        const body = new FormData();
        body.append('file', file);
        return { url: `/products/${id}/image`, method: 'POST', body };
      },
      invalidatesTags: ['Product'],
    }),
    removeProductImage: builder.mutation<Product, string>({ query: (id) => ({ url: `/products/${id}/image`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    deleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    restoreProduct: builder.mutation<Product, string>({ query: (id) => ({ url: `/products/${id}/restore`, method: 'PATCH' }), invalidatesTags: ['Product'] }),
    permanentlyDeleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}/permanent`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    orders: builder.query<OrderList, { customerId?: string; q?: string; status?: OrderStatus; workFilter?: OrderWorkFilter; paymentOutstanding?: boolean; dateFrom?: string; dateTo?: string; sortDirection?: 'asc' | 'desc'; archiveView?: 'ACTIVE' | 'ARCHIVED'; page: number; pageSize: number }>({
      query: (params) => ({ url: '/orders', params }),
      providesTags: ['Order'],
    }),
    orderStatusCounts: builder.query<OrderStatusCounts, string | undefined>({
      query: (customerId) => ({ url: '/orders/status-counts', params: customerId ? { customerId } : undefined }),
      providesTags: ['Order'],
    }),
    reportOverview: builder.query<ReportOverview, { dateFrom?: string; dateTo?: string }>({
      query: (params) => ({ url: '/reports/overview', params }),
      providesTags: ['Order'],
    }),
    dashboardOverview: builder.query<DashboardOverview, void>({
      query: () => '/reports/dashboard',
      providesTags: ['Order', 'Customer'],
    }),
    order: builder.query<Order, string>({ query: (id) => `/orders/${id}`, providesTags: (_result, _error, id) => [{ type: 'Order', id }] }),
    createOrder: builder.mutation<Order, OrderInput & { idempotencyKey: string }>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    updateOrder: builder.mutation<Order, { id: string; data: OrderUpdateInput }>({
      query: ({ id, data }) => ({ url: `/orders/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    updateOrderStatus: builder.mutation<Order, { id: string; status: OrderStatus }>({
      query: ({ id, status }) => ({ url: `/orders/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Order'],
    }),
    bulkUpdateOrderStatus: builder.mutation<{ count: number }, { ids: string[]; status: OrderStatus }>({
      query: (body) => ({ url: '/orders/bulk-status', method: 'PATCH', body }),
      invalidatesTags: ['Order'],
    }),
    createOrderPayment: builder.mutation<Payment, { id: string; idempotencyKey: string; amount: number; method: PaymentMethod; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/payments`, method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    cancelOrder: builder.mutation<Order, { id: string; reason: string; refundMethod?: PaymentMethod; refundBankName?: string; refundAccountNumber?: string; refundAccountName?: string }>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    confirmOrderRefund: builder.mutation<Order, { id: string; confirmed: boolean; reference?: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/refund`, method: 'POST', body }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    archiveOrder: builder.mutation<Order, string>({
      query: (id) => ({ url: `/orders/${id}/archive`, method: 'POST' }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    restoreOrder: builder.mutation<Order, string>({
      query: (id) => ({ url: `/orders/${id}/restore`, method: 'POST' }),
      invalidatesTags: ['Order', 'Customer'],
    }),
    permanentlyDeleteOrder: builder.mutation<void, string>({
      query: (id) => ({ url: `/orders/${id}/permanent`, method: 'DELETE' }),
      invalidatesTags: ['Order', 'Customer'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useCustomersQuery,
  useDeletedCustomersQuery,
  useCustomerQuery,
  useCreateCustomerMutation,
  usePreviewCustomerImportMutation,
  useImportCustomersMutation,
  useUpdateCustomerMutation,
  useRestoreCustomerMutation,
  usePermanentlyDeleteCustomerMutation,
  useDeleteCustomerMutation,
  useBulkDeleteCustomersMutation,
  useEyeExamsQuery,
  useArchivedEyeExamsQuery,
  usePreviewEyeExamImportMutation,
  useImportEyeExamsMutation,
  useEyeExamQuery,
  useEyeExamHistoryQuery,
  useCustomerEyeExamsQuery,
  useCreateEyeExamMutation,
  useFinalizeEyeExamMutation,
  useUpdateEyeExamMutation,
  useFinalizeExistingEyeExamMutation,
  useLockEyeExamMutation,
  useUnlockEyeExamMutation,
  useArchiveEyeExamMutation,
  useBulkArchiveEyeExamsMutation,
  useRestoreEyeExamMutation,
  usePermanentlyDeleteEyeExamMutation,
  useSettingQuery,
  useUpdateSettingMutation,
  useProductsQuery,
  useDeletedProductsQuery,
  useLazyNextProductSkuQuery,
  usePreviewProductImportMutation,
  useImportProductsMutation,
  useProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useUploadProductImageMutation,
  useRemoveProductImageMutation,
  useDeleteProductMutation,
  useRestoreProductMutation,
  usePermanentlyDeleteProductMutation,
  useOrdersQuery,
  useOrderStatusCountsQuery,
  useReportOverviewQuery,
  useDashboardOverviewQuery,
  useOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useUpdateOrderStatusMutation,
  useBulkUpdateOrderStatusMutation,
  useCreateOrderPaymentMutation,
  useCancelOrderMutation,
  useConfirmOrderRefundMutation,
  useArchiveOrderMutation,
  useRestoreOrderMutation,
  usePermanentlyDeleteOrderMutation,
} = api;
