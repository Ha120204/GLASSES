import type { ClipboardEvent, KeyboardEvent } from 'react';

export const formatVndInput = (value: string | number | undefined): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
};

export const parseVndInput = (value: string | undefined): number => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const navigationKeys = new Set(['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

const preventNonIntegerKey = (event: KeyboardEvent<HTMLInputElement>): void => {
  const isShortcut = (event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());
  if (/^\d$/.test(event.key) || navigationKeys.has(event.key) || isShortcut) return;
  event.preventDefault();
};

const preventNonIntegerPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
  if (!/^\d+$/.test(event.clipboardData.getData('text').trim())) event.preventDefault();
};

export const integerOnlyInputProps = { onKeyDown: preventNonIntegerKey, onPaste: preventNonIntegerPaste };
