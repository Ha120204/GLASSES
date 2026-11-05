export interface VietQrInput {
  bankBin: string;
  accountNumber: string;
  amount: number;
  addInfo: string;
}

const tlv = (id: string, value: string): string => id + String(value.length).padStart(2, '0') + value;

const crc16Ccitt = (value: string): string => {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
};

export const createTransferContent = (_prefix: string, orderCode: string): string => {
  const normalizedOrderCode = orderCode.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  // The order code is already unique and is the reference staff use to reconcile
  // bank transfers. Adding a configurable prefix can duplicate it (for example,
  // DH-DH-...) and makes reconciliation harder.
  if (normalizedOrderCode.length <= 25) return normalizedOrderCode;
  return normalizedOrderCode.slice(0, 25);
};

export const buildVietQrPayload = ({ bankBin, accountNumber, amount, addInfo }: VietQrInput): string => {
  if (!/^\d{6}$/.test(bankBin)) throw new Error('Mã BIN ngân hàng không hợp lệ.');
  if (!/^\d{6,30}$/.test(accountNumber)) throw new Error('Số tài khoản không hợp lệ.');
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Số tiền thanh toán không hợp lệ.');
  if (!/^[A-Z0-9-]{1,25}$/.test(addInfo)) throw new Error('Nội dung chuyển khoản không hợp lệ.');

  const beneficiary = tlv('00', bankBin) + tlv('01', accountNumber);
  const merchantAccount = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const payload = [
    tlv('00', '01'),
    tlv('01', '12'),
    tlv('38', merchantAccount),
    tlv('53', '704'),
    tlv('54', String(amount)),
    tlv('58', 'VN'),
    tlv('62', tlv('08', addInfo)),
  ].join('');
  return payload + '6304' + crc16Ccitt(payload + '6304');
};
