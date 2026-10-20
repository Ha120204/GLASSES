export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s.\-()]/g, '');
  if (normalized.startsWith('+84')) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith('84') && normalized.length >= 10)
    normalized = `0${normalized.slice(2)}`;
  return normalized;
}
