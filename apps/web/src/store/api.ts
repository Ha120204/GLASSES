import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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
export interface CustomerImportIssue { row: number; reason: string; }
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
  orders: Array<{ id: string; code: string; status: string; total: number; createdAt: string }>;
}

export interface EyeExam {
  id: string; customerId: string; examDate: string; examiner: string | null; note: string | null; createdAt: string; lockedAt: string | null; archivedAt: string | null; pdTotal: number | null; wearingPurpose: string | null; lensDesign: string | null; noPrescription: boolean; noPrescriptionReason: string | null;
  rSph: number | null; rCyl: number | null; rAxis: number | null; rAdd: number | null; rPd: number | null; rPrism: number | null; rBase: PrismBase | null; rSegHeight: number | null;
  lSph: number | null; lCyl: number | null; lAxis: number | null; lAdd: number | null; lPd: number | null; lPrism: number | null; lBase: PrismBase | null; lSegHeight: number | null;
  customer?: { id: string; name: string; phone: string; birthday?: string | null; address?: string | null };
  setting?: { storeName: string; address: string | null; phone: string | null; invoiceTemplate: string | null } | null;
}
export type EyeExamStatusFilter = 'DRAFT' | 'LOCKED';
export interface EyeExamListQuery { customerId?: string; q?: string; dateFrom?: string; dateTo?: string; status?: EyeExamStatusFilter; page: number; pageSize: number; }
export interface EyeExamImportRow { row: number; phone: string; examDate: string; rSph?: number; rCyl?: number; rAxis?: number; rAdd?: number; rPd?: number; rPrism?: number; rBase?: PrismBase; rSegHeight?: number; lSph?: number; lCyl?: number; lAxis?: number; lAdd?: number; lPd?: number; lPrism?: number; lBase?: PrismBase; lSegHeight?: number; pdTotal?: number; wearingPurpose?: string; lensDesign?: string; noPrescription: boolean; noPrescriptionReason?: string; note?: string; }
export interface EyeExamImportIssue { row: number; reason: string; }
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
export interface StoreSetting {
  id: string;
  storeName: string;
  address: string | null;
  phone: string | null;
  invoiceTemplate: string | null;
}
export interface StoreSettingInput {
  storeName?: string;
  address?: string | null;
  phone?: string | null;
  invoiceTemplate?: string | null;
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
}
export interface ProductInput {
  sku: string;
  autoSku?: boolean;
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
export type OrderStatus = 'NEW' | 'LENS_ORDERED' | 'PROCESSING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type OrderType = 'PREORDER' | 'READY_SALE';
export type OrderWorkFilter = 'ACTION_NEEDED' | 'TODAY' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'TRANSFER';
export type PaymentType = 'PAYMENT' | 'REFUND';
export type UserRole = 'ADMIN' | 'STAFF';
export const paymentMethodLabels: Record<PaymentMethod, string> = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản' };
export interface OrderStatusCounts {
  total: number;
  byStatus: Record<OrderStatus, number>;
  work: { outstanding: number; actionNeeded: number; today: number; overdue: number };
}
export interface ReportOverview {
  period: { dateFrom: string; dateTo: string };
  summary: { orderSales: number; collected: number; outstanding: number; orderCount: number; actionNeeded: number };
  dailySales: Array<{ date: string; sales: number; orders: number }>;
  statusCounts: Record<OrderStatus, number>;
  paymentByMethod: Record<PaymentMethod, number>;
  topProducts: Array<{ name: string; qty: number; sales: number }>;
}
export interface DashboardOverview {
  today: string;
  summary: { collectedToday: number; newOrders: number; outstanding: number; actionNeeded: number };
  tasks: { overdue: number; dueToday: number; actionNeeded: number };
  recentOrders: Array<{ id: string; code: string; status: OrderStatus; total: number; dueDate: string | null; createdAt: string; customer: { name: string; phone: string } }>;
  dailySales: Array<{ date: string; sales: number }>;
}
export const orderStatusLabels: Record<OrderStatus, string> = {
  NEW: 'Mới',
  LENS_ORDERED: 'Đã đặt tròng',
  PROCESSING: 'Đang gia công',
  READY: 'Sẵn sàng giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};
export const orderTypeLabels: Record<OrderType, string> = { PREORDER: 'Đặt trước / gia công', READY_SALE: 'Bán hàng có sẵn' };
export const orderStatusColors: Record<OrderStatus, string> = {
  NEW: 'blue',
  LENS_ORDERED: 'purple',
  PROCESSING: 'orange',
  READY: 'cyan',
  DELIVERED: 'green',
  CANCELLED: 'default',
};
export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  qty: number;
  product: Product | null;
}
export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  type: PaymentType;
  paidAt: string;
  note: string | null;
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
  depositMethod: PaymentMethod | null;
  dueDate: string | null;
  warrantyUntil: string | null;
  note: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string };
  createdBy: { id: string; name: string } | null;
  items: OrderItem[];
  payments: Payment[];
  statusHistory: Array<{ id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; createdAt: string; createdBy: { id: string; name: string } | null }>;
}
export interface OrderInput {
  orderType?: OrderType;
  customerId: string;
  eyeExamId?: string | null;
  items: Array<{ productId: string; qty: number }>;
  discount?: number;
  deposit?: number;
  depositMethod?: PaymentMethod;
  dueDate?: string | null;
  warrantyUntil?: string | null;
  note?: string | null;
}
export type OrderUpdateInput = Omit<OrderInput, 'deposit' | 'depositMethod' | 'orderType'>;
interface EyeExamList { items: EyeExam[]; total: number; page: number; pageSize: number; }

interface CustomerList {
  items: Customer[];
  total: number;
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
}

export const getErrorMessage = (error: unknown): string => {
  const apiError = error as ApiError;
  const message = apiError.data?.message;
  return Array.isArray(message)
    ? (message[0] ?? 'Có lỗi xảy ra.')
    : (message ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'include' }),
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
    customers: builder.query<CustomerList, { q?: string; page: number; pageSize: number }>({
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
    createEyeExam: builder.mutation<EyeExam, EyeExamInput>({ query: (body) => ({ url: '/eye-exams', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
    finalizeEyeExam: builder.mutation<EyeExam, EyeExamInput>({ query: (body) => ({ url: '/eye-exams/finalize', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
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
    setting: builder.query<StoreSetting, void>({ query: () => '/settings', providesTags: ['Setting'] }),
    updateSetting: builder.mutation<StoreSetting, StoreSettingInput>({ query: (body) => ({ url: '/settings', method: 'PATCH', body }), invalidatesTags: ['Setting', 'EyeExam'] }),
    products: builder.query<ProductList, { q?: string; type?: ProductType; page: number; pageSize: number }>({
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
    deleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    restoreProduct: builder.mutation<Product, string>({ query: (id) => ({ url: `/products/${id}/restore`, method: 'PATCH' }), invalidatesTags: ['Product'] }),
    permanentlyDeleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}/permanent`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    orders: builder.query<OrderList, { customerId?: string; q?: string; status?: OrderStatus; workFilter?: OrderWorkFilter; paymentOutstanding?: boolean; dateFrom?: string; dateTo?: string; sortDirection?: 'asc' | 'desc'; page: number; pageSize: number }>({
      query: (params) => ({ url: '/orders', params }),
      providesTags: ['Order'],
    }),
    orderStatusCounts: builder.query<OrderStatusCounts, void>({
      query: () => '/orders/status-counts',
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
    createOrder: builder.mutation<Order, OrderInput>({
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
    createOrderPayment: builder.mutation<Payment, { id: string; amount: number; method: PaymentMethod; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/payments`, method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    cancelOrder: builder.mutation<Order, { id: string; reason: string; refundMethod?: PaymentMethod }>({
      query: ({ id, ...body }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body }),
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
} = api;
