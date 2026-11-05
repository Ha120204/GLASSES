'use client';

import { CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Empty, Modal, Spin, Tag } from 'antd';
import Image from 'next/image';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVietQrPayload, createTransferContent } from '@/lib/vietqr';
import {
  orderStatusColors,
  orderStatusLabels,
  type Order,
  useOrderQuery,
  useSettingQuery,
} from '@/store/api';

interface OrderPrintModalProps {
  orderId: string | null;
  onClose: () => void;
}

const formatMoney = (value: number): string => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDate = (value: string | null): string =>
  value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(value)) : '—';
const paidAmount = (order: Order): number =>
  order.deposit +
  order.payments.reduce(
    (sum, payment) => sum + (payment.type === 'PAYMENT' ? payment.amount : -payment.amount),
    0,
  );
const formatRxValue = (value: number | null, suffix = ''): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${value}${suffix}`;
const wearingPurposeLabels: Record<string, string> = {
  DISTANCE: 'Nhìn xa',
  NEAR: 'Đọc gần',
  INTERMEDIATE: 'Máy tính / trung gian',
  MULTIPURPOSE: 'Đa mục đích',
};
const lensDesignLabels: Record<string, string> = {
  SINGLE_VISION: 'Tròng đơn',
  BIFOCAL: 'Hai tròng',
  PROGRESSIVE: 'Đa tròng',
};

export function OrderPrintModal({ orderId, onClose }: OrderPrintModalProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const printRootRef = useRef<HTMLDivElement | null>(null);
  const { data: order, isLoading, isError } = useOrderQuery(orderId ?? '', { skip: !orderId });
  const { data: setting, isLoading: isLoadingSetting } = useSettingQuery(undefined, {
    skip: !orderId,
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>();
  const [qrError, setQrError] = useState(false);
  const open = Boolean(orderId);
  const print = (): void => {
    if (!sheetRef.current) return;
    printRootRef.current?.remove();
    const printRoot = document.createElement('div');
    printRoot.className = 'order-print-root';
    printRoot.appendChild(sheetRef.current.cloneNode(true));
    document.body.appendChild(printRoot);
    printRootRef.current = printRoot;
    const cleanup = (): void => {
      printRoot.remove();
      if (printRootRef.current === printRoot) printRootRef.current = null;
      document.body.classList.remove('printing-order');
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.add('printing-order');
    window.addEventListener('afterprint', cleanup, { once: true });
    try { window.print(); } finally { cleanup(); }
  };
  useEffect(() => () => {
    printRootRef.current?.remove();
    document.body.classList.remove('printing-order');
  }, []);
  const paid = order ? paidAmount(order) : 0;
  const balance = order && order.status !== 'CANCELLED' ? Math.max(0, order.total - paid) : 0;
  const isQrConfigured = Boolean(
    setting?.qrPaymentEnabled &&
    setting.bankBin &&
    setting.bankAccountNumber &&
    setting.bankAccountName,
  );
  const shouldShowPaymentQr = Boolean(order && balance > 0 && isQrConfigured);
  const transferContent = useMemo(
    () =>
      order && setting ? createTransferContent(setting.transferContentPrefix, order.code) : '',
    [order, setting],
  );
  const isPreparingQr = shouldShowPaymentQr && !qrDataUrl && !qrError;
  const prescription = order?.prescriptionSnapshot;
  const hasPrescription = Boolean(prescription && !prescription.noPrescription);
  const hasCustomerAddress = Boolean(order?.customer.address);
  const hasDeliveryDate = Boolean(order?.dueDate);

  useEffect(() => {
    if (!shouldShowPaymentQr || !setting || !order) {
      setQrDataUrl(undefined);
      setQrError(false);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(
      buildVietQrPayload({
        bankBin: setting.bankBin!,
        accountNumber: setting.bankAccountNumber!,
        amount: balance,
        addInfo: transferContent,
      }),
      {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
        color: { dark: '#142e55', light: '#ffffff' },
      },
    )
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(undefined);
          setQrError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [balance, order, setting, shouldShowPaymentQr, transferContent]);

  return (
    <Modal
      className="order-print-modal"
      open={open}
      centered
      destroyOnHidden
      width={900}
      onCancel={onClose}
      title={
        <div className="order-print-modal__heading">
          <span>
            <PrinterOutlined />
          </span>
          <div>
            <strong>Xem trước phiếu đơn hàng</strong>
            <p>Kiểm tra nội dung trước khi in hoặc gửi cho khách.</p>
          </div>
        </div>
      }
      footer={
        <div className="order-print-modal__footer">
          <Button icon={<CloseOutlined />} onClick={onClose}>
            Đóng
          </Button>
          <Button
            className="order-print-modal__print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={print}
            disabled={!order || (balance > 0 && (isLoadingSetting || isPreparingQr || qrError))}
          >
            In phiếu đơn
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="order-print-modal__loading">
          <Spin size="large" />
        </div>
      ) : null}
      {isError ? <Empty description="Không thể tải dữ liệu phiếu in." /> : null}
      {order ? (
        <article ref={sheetRef} className="order-print-sheet">
          <header className="order-print-sheet__header">
            <div className="order-print-sheet__store">
              <span>{setting?.storeName || 'Cửa hàng kính mắt'}</span>
              {setting?.address || setting?.phone ? (
                <p>{[setting?.address, setting?.phone].filter(Boolean).join(' · ')}</p>
              ) : (
                <p>Thông tin cửa hàng</p>
              )}
            </div>
            <div className="order-print-sheet__document">
              <span>PHIẾU BÁN HÀNG</span>
              <h1>{order.code}</h1>
              <p>Ngày tạo: {formatDate(order.createdAt)}</p>
              <Tag color={orderStatusColors[order.status]}>
                Trạng thái: {orderStatusLabels[order.status]}
              </Tag>
            </div>
          </header>
          <section
            className={`order-print-sheet__customer${
              hasDeliveryDate ? ' order-print-sheet__customer--with-delivery' : ''
            }`}
          >
            <div>
              <span>Khách hàng</span>
              <strong>{order.customer.name}</strong>
            </div>
            <div>
              <span>Số điện thoại</span>
              <strong>{order.customer.phone}</strong>
            </div>
            {hasDeliveryDate ? (
              <div>
                <span>Hẹn khách lấy kính</span>
                <strong>{formatDate(order.dueDate)}</strong>
              </div>
            ) : null}
            {hasCustomerAddress ? (
              <div className="order-print-sheet__customer-address">
                <span>Địa chỉ</span>
                <strong>{order.customer.address}</strong>
              </div>
            ) : null}
          </section>
          <section className="order-print-sheet__items">
            <h2>Sản phẩm trong đơn</h2>
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td>{formatMoney(item.unitPrice * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {hasPrescription && prescription ? (
            <section className="order-print-sheet__prescription">
              <div className="order-print-sheet__section-heading">
                <h2>Thông số lắp kính</h2>
                {prescription.wearingPurpose || prescription.lensDesign ? (
                  <span>
                    {[
                      prescription.wearingPurpose
                        ? wearingPurposeLabels[prescription.wearingPurpose] ?? prescription.wearingPurpose
                        : null,
                      prescription.lensDesign
                        ? lensDesignLabels[prescription.lensDesign] ?? prescription.lensDesign
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Mắt</th>
                    <th>SPH</th>
                    <th>CYL</th>
                    <th>AXIS</th>
                    <th>ADD</th>
                    <th>PD đơn mắt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>OD · Phải</th>
                    <td>{formatRxValue(prescription.rSph, ' D')}</td>
                    <td>{formatRxValue(prescription.rCyl, ' D')}</td>
                    <td>{formatRxValue(prescription.rAxis, '°')}</td>
                    <td>{formatRxValue(prescription.rAdd, ' D')}</td>
                    <td>{formatRxValue(prescription.rPd, ' mm')}</td>
                  </tr>
                  <tr>
                    <th>OS · Trái</th>
                    <td>{formatRxValue(prescription.lSph, ' D')}</td>
                    <td>{formatRxValue(prescription.lCyl, ' D')}</td>
                    <td>{formatRxValue(prescription.lAxis, '°')}</td>
                    <td>{formatRxValue(prescription.lAdd, ' D')}</td>
                    <td>{formatRxValue(prescription.lPd, ' mm')}</td>
                  </tr>
                </tbody>
              </table>
              {prescription.pdTotal !== null ? (
                <p>PD tổng: <strong>{formatRxValue(prescription.pdTotal, ' mm')}</strong></p>
              ) : null}
            </section>
          ) : null}
          <section className="order-print-sheet__bottom">
            <div className="order-print-sheet__meta">
              {order.warrantyUntil ? (
                <span>
                  <b>Bảo hành đến:</b> {formatDate(order.warrantyUntil)}
                </span>
              ) : null}
              {order.note ? (
                <span>
                  <b>Ghi chú:</b> {order.note}
                </span>
              ) : null}
              {shouldShowPaymentQr && qrDataUrl ? (
                <div className="order-print-sheet__qr">
                  <Image
                    src={qrDataUrl}
                    alt={'Mã VietQR thanh toán ' + formatMoney(balance) + ' cho đơn ' + order.code}
                    width={104}
                    height={104}
                    loading="eager"
                    unoptimized
                  />
                  <div>
                    <b>QUÉT QR THANH TOÁN PHẦN CÒN LẠI</b>
                    <strong>{formatMoney(balance)}</strong>
                    <span>
                      {setting!.bankName} · {setting!.bankAccountNumber}
                    </span>
                    <span>Nội dung: {transferContent}</span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="order-print-sheet__totals">
              <span>
                Tạm tính <b>{formatMoney(order.subtotal)}</b>
              </span>
              <span>
                Chiết khấu <b>−{formatMoney(order.discount)}</b>
              </span>
              <strong>
                Tổng đơn <b>{formatMoney(order.total)}</b>
              </strong>
              {order.deposit > 0 ? (
                <span className="order-print-sheet__deposit">
                  Đã nhận / tiền cọc <b>{formatMoney(order.deposit)}</b>
                </span>
              ) : null}
              {paid > order.deposit ? (
                <span>
                  Đã thu thêm <b>{formatMoney(paid - order.deposit)}</b>
                </span>
              ) : null}
              <strong className="order-print-sheet__paid">
                Đã nhận <b>{formatMoney(paid)}</b>
              </strong>
              <strong
                className={
                  balance > 0 ? 'order-print-sheet__balance' : 'order-print-sheet__settled'
                }
              >
                  {order.status === 'CANCELLED' ? 'Đơn đã hủy' : balance > 0 ? 'Còn phải thu' : 'Đã thanh toán đủ'} <b>{formatMoney(balance)}</b>
              </strong>
            </div>
          </section>
          <section className="order-print-sheet__policy">
            <strong>Lưu ý bảo hành</strong>
            <p>
              Vui lòng giữ phiếu này để đối chiếu. Sản phẩm được bảo hành theo chính sách của cửa hàng;
              hàng làm theo thông số riêng được kiểm tra và điều chỉnh theo thỏa thuận khi nhận hàng.
            </p>
          </section>
          <section className="order-print-sheet__signatures">
            <div>
              <strong>Khách hàng xác nhận</strong>
              <span>(Ký và ghi rõ họ tên)</span>
            </div>
            <div>
              <strong>Cửa hàng xác nhận</strong>
              <span>(Ký và ghi rõ họ tên)</span>
            </div>
          </section>
          <footer>
            <div>
              <strong>Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ.</strong>
              <span>Vui lòng giữ phiếu để đối chiếu khi cần.</span>
            </div>
            <span>Ngày in: {formatDate(new Date().toISOString())}</span>
          </footer>
        </article>
      ) : null}
    </Modal>
  );
}
