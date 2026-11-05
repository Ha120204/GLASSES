'use client';

import { CopyOutlined, QrcodeOutlined } from '@ant-design/icons';
import { Alert, Button, InputNumber, Modal, Spin, message } from 'antd';
import Image from 'next/image';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatVndInput, integerOnlyInputProps, parseVndInput } from '@/lib/money-input';
import { buildVietQrPayload, createTransferContent } from '@/lib/vietqr';
import type { Order } from '@/store/api';
import { useSettingQuery } from '@/store/api';

interface PaymentQrModalProps {
  open: boolean;
  order: Order | null;
  balance: number;
  initialAmount?: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  confirming: boolean;
  requireFullPayment?: boolean;
  confirmLabel?: string;
}

const formatMoney = (value: number): string => new Intl.NumberFormat('vi-VN').format(value) + ' ₫';

const copyText = async (value: string, successMessage: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(value);
    message.success(successMessage);
  } catch {
    message.error('Không thể sao chép. Vui lòng thử lại.');
  }
};

export function PaymentQrModal({ open, order, balance, initialAmount, onClose, onConfirm, confirming, requireFullPayment = false, confirmLabel = 'Đã nhận chuyển khoản' }: PaymentQrModalProps) {
  const { data: setting, isLoading, isError, refetch } = useSettingQuery(undefined, { skip: !open });
  const [amount, setAmount] = useState<number | null>(balance);
  const [qrDataUrl, setQrDataUrl] = useState<string>();
  const [qrError, setQrError] = useState<string>();
  const confirmingRef = useRef(false);

  const transferContent = useMemo(
    () => order && setting ? createTransferContent(setting.transferContentPrefix, order.code) : '',
    [order, setting],
  );
  const configurationError = isError ? undefined : !setting?.qrPaymentEnabled
    ? 'Thanh toán QR chưa được bật trong Cài đặt.'
    : !setting.bankName || !setting.bankBin || !setting.bankAccountNumber || !setting.bankAccountName
      ? 'Chưa điền đủ thông tin tài khoản nhận thanh toán trong Cài đặt.'
      : undefined;
  const validAmount = amount !== null && Number.isInteger(amount) && amount > 0 && amount <= balance && (!requireFullPayment || amount === balance);

  useEffect(() => {
    if (open) setAmount(initialAmount ?? balance);
  }, [balance, initialAmount, open, order?.id]);

  useEffect(() => {
    if (!open || !setting || !validAmount || configurationError || isError) {
      setQrDataUrl(undefined);
      setQrError(undefined);
      return;
    }
    let cancelled = false;
    const payload = buildVietQrPayload({
      bankBin: setting.bankBin!,
      accountNumber: setting.bankAccountNumber!,
      amount: amount!,
      addInfo: transferContent,
    });
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#142e55', light: '#ffffff' } })
      .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setQrError('Không thể tạo mã QR. Vui lòng thử lại.'); });
    return () => { cancelled = true; };
  }, [amount, configurationError, isError, open, setting, transferContent, validAmount]);

  const confirm = async (): Promise<void> => {
    if (!validAmount || confirmingRef.current) return;
    confirmingRef.current = true;
    try { await onConfirm(amount!); } finally { confirmingRef.current = false; }
  };

  return <Modal className="payment-qr-modal" centered open={open} onCancel={onClose} destroyOnHidden width={640} zIndex={1100}
    title={<div className="payment-qr-modal__title"><span><QrcodeOutlined /></span><div><strong>Thanh toán qua mã QR</strong><small>{order ? 'Đơn hàng ' + order.code : 'Kiểm tra thông tin trước khi khách quét mã.'}</small></div></div>}
    footer={<div className="payment-qr-modal__footer"><Button onClick={onClose}>Đóng</Button><Button type="primary" loading={confirming} disabled={!validAmount || Boolean(configurationError) || isError || !qrDataUrl} onClick={confirm}>{confirmLabel}</Button></div>}>
    {isLoading ? <div className="payment-qr-modal__loading"><Spin /></div> : null}
    {!isLoading && isError ? <Alert type="error" showIcon message="Không thể tải cài đặt QR." action={<Button size="small" onClick={() => void refetch()}>Thử lại</Button>} /> : null}
    {!isLoading && !isError && configurationError ? <Alert type="warning" showIcon message={configurationError} description="Vào Cài đặt để kiểm tra thông tin ngân hàng, sau đó mở lại mã QR." /> : null}
    {!isLoading && !isError && !configurationError && order ? <div className="payment-qr-modal__content">
      <div className="payment-qr-modal__amount">
        <span>Số tiền khách cần chuyển</span>
        <InputNumber aria-label="Số tiền thanh toán QR" disabled={requireFullPayment} value={amount} onChange={setAmount} min={1} max={balance} precision={0} inputMode="numeric" formatter={formatVndInput} parser={parseVndInput} {...integerOnlyInputProps} />
        <small>{requireFullPayment ? 'Đơn bán giao ngay cần thanh toán đủ để hoàn tất.' : `Còn phải thu: ${formatMoney(balance)}`}</small>
      </div>
      {qrError ? <Alert type="error" showIcon message={qrError} /> : null}
      {qrDataUrl ? <div className="payment-qr-modal__code"><Image src={qrDataUrl} alt={'Mã VietQR thanh toán ' + formatMoney(amount ?? 0) + ' cho đơn ' + order.code} width={360} height={360} loading="eager" unoptimized /><strong>{formatMoney(amount ?? 0)}</strong><span>Khách mở ứng dụng ngân hàng và quét mã này.</span></div> : !qrError ? <div className="payment-qr-modal__loading"><Spin /></div> : null}
      <div className="payment-qr-modal__account">
        <div><span>Ngân hàng</span><strong>{setting!.bankName}</strong></div>
        <div><span>Số tài khoản</span><strong>{setting!.bankAccountNumber}</strong><Button type="link" icon={<CopyOutlined />} onClick={() => void copyText(setting!.bankAccountNumber!, 'Đã sao chép số tài khoản.')}>Sao chép</Button></div>
        <div><span>Chủ tài khoản</span><strong>{setting!.bankAccountName}</strong></div>
        <div><span>Nội dung chuyển khoản</span><strong>{transferContent}</strong><Button type="link" icon={<CopyOutlined />} onClick={() => void copyText(transferContent, 'Đã sao chép nội dung chuyển khoản.')}>Sao chép</Button></div>
      </div>
      <Alert className="payment-qr-modal__notice" type="info" showIcon message="Mã QR không tự xác nhận giao dịch." description="Chỉ bấm “Đã nhận chuyển khoản” sau khi cửa hàng đã kiểm tra tiền vào tài khoản." />
    </div> : null}
  </Modal>;
}
