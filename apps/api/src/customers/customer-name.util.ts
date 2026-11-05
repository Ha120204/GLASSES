export const customerNamePattern = /^[\p{L}\p{M}]+(?:[ '\-’][\p{L}\p{M}]+)*$/u;

export function normalizeCustomerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isCustomerName(value: string): boolean {
  return customerNamePattern.test(normalizeCustomerName(value));
}
