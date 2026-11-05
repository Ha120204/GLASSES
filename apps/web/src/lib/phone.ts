export const normalizeVietnamPhone = (value: string): string => {
  let normalized = value.replace(/[\s.\-()]/g, '');
  if (normalized.startsWith('+84')) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith('84') && normalized.length >= 10) normalized = `0${normalized.slice(2)}`;
  return normalized;
};

export const isVietnamPhone = (value: string): boolean => /^0(?:2|3|5|7|8|9)\d{8}$/.test(normalizeVietnamPhone(value));

export const validateVietnamPhone = (_rule: unknown, value?: string): Promise<void> => {
  if (!value?.trim() || isVietnamPhone(value)) return Promise.resolve();
  return Promise.reject(new Error('Nhập số điện thoại Việt Nam 10 số hợp lệ, ví dụ: 0901 234 567.'));
};
