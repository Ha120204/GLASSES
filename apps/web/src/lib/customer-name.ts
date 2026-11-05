export const normalizeCustomerName = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const isCustomerName = (value: string): boolean => /^[\p{L}\p{M}]+(?:[ '\-’][\p{L}\p{M}]+)*$/u.test(normalizeCustomerName(value));

export const validateCustomerName = (_rule: unknown, value?: string): Promise<void> => {
  if (!value?.trim() || isCustomerName(value)) return Promise.resolve();
  return Promise.reject(new Error('Họ tên chỉ được gồm chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy đơn.'));
};
