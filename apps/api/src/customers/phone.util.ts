export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s.\-()]/g, '');
  if (normalized.startsWith('+84')) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith('84') && normalized.length >= 10)
    normalized = `0${normalized.slice(2)}`;
  return normalized;
}

export const vietnamPhonePattern = /^0(?:2|3|5|7|8|9)\d{8}$/;

export function isVietnamPhone(phone: string): boolean {
  return vietnamPhonePattern.test(normalizePhone(phone));
}
