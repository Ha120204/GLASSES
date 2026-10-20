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

export interface CustomerDetail extends Customer {
  eyeExams: EyeExam[];
  latestEyeExam: EyeExam | null;
  orders: Array<{ id: string; code: string; status: string; total: number; createdAt: string }>;
}

export interface EyeExam {
  id: string; customerId: string; examDate: string; examiner: string | null; note: string | null; nextReminderDate: string | null; createdAt: string;
  rSph: number | null; rCyl: number | null; rAxis: number | null; rAdd: number | null; rPd: number | null;
  lSph: number | null; lCyl: number | null; lAxis: number | null; lAdd: number | null; lPd: number | null;
  customer?: { id: string; name: string; phone: string; birthday?: string | null; address?: string | null };
  setting?: { storeName: string; address: string | null; phone: string | null } | null;
}
export interface EyeExamInput { customerId: string; examDate: string; examiner?: string; note?: string; nextReminderDate?: string | null; rSph?: number; rCyl?: number; rAxis?: number; rAdd?: number; rPd?: number; lSph?: number; lCyl?: number; lAxis?: number; lAdd?: number; lPd?: number; }
export interface StoreSetting {
  id: string;
  storeName: string;
  address: string | null;
  phone: string | null;
  invoiceTemplate: string | null;
  reminderMonths: number;
}
export interface StoreSettingInput {
  storeName?: string;
  address?: string | null;
  phone?: string | null;
  invoiceTemplate?: string | null;
  reminderMonths?: number;
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
  stockQty: number;
  minStock: number;
  supplier: string | null;
  active: boolean;
  deletedAt: string | null;
}
export interface ProductInput {
  sku: string;
  barcode?: string | null;
  name: string;
  type: ProductType;
  brand?: string | null;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  minStock?: number;
  supplier?: string | null;
  active?: boolean;
}
export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';
export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  qty: number;
  note: string | null;
  createdAt: string;
}
export interface StockMovementInput {
  type: StockMovementType;
  qty: number;
  adjustmentDirection?: 'IN' | 'OUT';
  note?: string;
}
export interface StockMovementHistoryItem extends StockMovement {
  product: Pick<Product, 'id' | 'sku' | 'name' | 'deletedAt'>;
}
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
interface StockMovementList {
  items: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
}
interface StockMovementHistoryList {
  items: StockMovementHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}
interface User {
  id: string;
  email: string;
  name: string;
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
  tagTypes: ['Customer', 'Auth', 'EyeExam', 'Setting', 'Product', 'StockMovement'],
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
    customer: builder.query<CustomerDetail, string>({
      query: (id) => `/customers/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Customer', id }],
    }),
    createCustomer: builder.mutation<Customer, CustomerInput>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: string; data: CustomerInput }>({
      query: ({ id, data }) => ({ url: `/customers/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['Customer'],
    }),
    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Customer'],
    }),
    eyeExams: builder.query<EyeExamList, { customerId?: string; q?: string; page: number; pageSize: number }>({ query: (params) => ({ url: '/eye-exams', params }), providesTags: ['EyeExam'] }),
    eyeExam: builder.query<EyeExam, string>({ query: (id) => `/eye-exams/${id}`, providesTags: (_r, _e, id) => [{ type: 'EyeExam', id }] }),
    customerEyeExams: builder.query<EyeExam[], string>({ query: (id) => `/customers/${id}/eye-exams`, providesTags: (_r, _e, id) => [{ type: 'EyeExam', id }] }),
    createEyeExam: builder.mutation<EyeExam, EyeExamInput>({ query: (body) => ({ url: '/eye-exams', method: 'POST', body }), invalidatesTags: ['EyeExam', 'Customer'] }),
    updateEyeExam: builder.mutation<EyeExam, { id: string; data: Partial<EyeExamInput> }>({ query: ({ id, data }) => ({ url: `/eye-exams/${id}`, method: 'PATCH', body: data }), invalidatesTags: ['EyeExam', 'Customer'] }),
    deleteEyeExam: builder.mutation<void, string>({ query: (id) => ({ url: `/eye-exams/${id}`, method: 'DELETE' }), invalidatesTags: ['EyeExam', 'Customer'] }),
    eyeExamConfig: builder.query<{ reminderMonths: number }, void>({ query: () => '/eye-exams/config', providesTags: ['Setting'] }),
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
    product: builder.query<Product, string>({ query: (id) => `/products/${id}`, providesTags: (_result, _error, id) => [{ type: 'Product', id }] }),
    createProduct: builder.mutation<Product, ProductInput>({ query: (body) => ({ url: '/products', method: 'POST', body }), invalidatesTags: ['Product'] }),
    updateProduct: builder.mutation<Product, { id: string; data: Omit<Partial<ProductInput>, 'stockQty'> }>({ query: ({ id, data }) => ({ url: `/products/${id}`, method: 'PATCH', body: data }), invalidatesTags: ['Product'] }),
    deleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    restoreProduct: builder.mutation<Product, string>({ query: (id) => ({ url: `/products/${id}/restore`, method: 'PATCH' }), invalidatesTags: ['Product'] }),
    permanentlyDeleteProduct: builder.mutation<void, string>({ query: (id) => ({ url: `/products/${id}/permanent`, method: 'DELETE' }), invalidatesTags: ['Product'] }),
    productStockMovements: builder.query<StockMovementList, { id: string; page: number; pageSize: number }>({
      query: ({ id, ...params }) => ({ url: `/products/${id}/stock-movements`, params }),
      providesTags: (_result, _error, { id }) => [{ type: 'StockMovement', id }],
    }),
    stockMovementHistory: builder.query<StockMovementHistoryList, { q?: string; type?: StockMovementType; dateFrom?: string; dateTo?: string; page: number; pageSize: number }>({
      query: (params) => ({ url: '/products/stock-movements', params }),
      providesTags: ['StockMovement'],
    }),
    createStockMovement: builder.mutation<{ product: Product; movement: StockMovement }, { id: string; data: StockMovementInput }>({
      query: ({ id, data }) => ({ url: `/products/${id}/stock-movements`, method: 'POST', body: data }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Product', id }, { type: 'StockMovement', id }],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useCustomersQuery,
  useCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useEyeExamsQuery,
  useEyeExamQuery,
  useCustomerEyeExamsQuery,
  useCreateEyeExamMutation,
  useUpdateEyeExamMutation,
  useDeleteEyeExamMutation,
  useEyeExamConfigQuery,
  useSettingQuery,
  useUpdateSettingMutation,
  useProductsQuery,
  useDeletedProductsQuery,
  useProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useRestoreProductMutation,
  usePermanentlyDeleteProductMutation,
  useProductStockMovementsQuery,
  useStockMovementHistoryQuery,
  useCreateStockMovementMutation,
} = api;
