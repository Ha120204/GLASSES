'use client';

import { CopyOutlined, ExportOutlined, InfoCircleOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Modal, message } from 'antd';
import { useState } from 'react';
import { createOrderZaloMessage } from '@/lib/order-zalo-message';
import { normalizeVietnamPhone } from '@/lib/phone';
import { type Order, useSettingQuery } from '@/store/api';

interface OrderZaloShareModalProps {
  order: Order;
  onClose: () => void;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // The fallback also works when clipboard access is denied in a desktop wrapper.
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
}

export function OrderZaloShareModal({ order, onClose }: OrderZaloShareModalProps) {
  const { data: setting, isLoading, isError } = useSettingQuery();
  const [editedText, setEditedText] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const text = editedText ?? createOrderZaloMessage(order, setting);
  const customerPhone = normalizeVietnamPhone(order.customer.phone);
  const zaloChatUrl = `https://chat.zalo.me/?phone=${encodeURIComponent(customerPhone)}&openConv=true`;

  const copy = async (value: string, successText: string): Promise<void> => {
    try {
      if (await copyText(value)) {
        messageApi.success(successText);
      } else {
        messageApi.error('Không sao chép được. Hãy chọn nội dung và sao chép thủ công.');
      }
    } catch {
      messageApi.error('Không sao chép được. Hãy chọn nội dung và sao chép thủ công.');
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
      className="order-zalo-share-modal"
      open
      centered
      width={620}
      title={<div className="order-zalo-share-modal__title"><span className="order-zalo-share-modal__icon"><MessageOutlined /></span><div><small>TIN NHẮN CHO KHÁCH</small><strong>Chuẩn bị tin Zalo</strong></div></div>}
      onCancel={onClose}
      footer={
        <div className="order-zalo-share-modal__footer">
          <Button onClick={onClose}>Đóng</Button>
          <Button icon={<CopyOutlined />} disabled={isLoading || !text.trim()} onClick={() => void copy(text, 'Đã sao chép nội dung tin nhắn.')}>
            Sao chép tin
          </Button>
          <Button
            type="primary"
            href={zaloChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExportOutlined />}
            disabled={isLoading || !text.trim()}
            onClick={() => void copy(text, 'Đã sao chép tin. Kiểm tra đúng khách trong Zalo rồi dán và gửi.')}
          >
            Sao chép tin & mở Zalo
          </Button>
        </div>
      }
    >
      <div className="order-zalo-share-modal__recipient">
        <div className="order-zalo-share-modal__recipient-details">
          <span>GỬI TỚI</span>
          <strong>{order.customer.name}</strong>
          <span className="order-zalo-share-modal__phone"><PhoneOutlined />{order.customer.phone}</span>
        </div>
        <Button icon={<CopyOutlined />} onClick={() => void copy(order.customer.phone, 'Đã sao chép số điện thoại khách.')}>
          Sao chép SĐT
        </Button>
      </div>
      {isError ? <Alert type="warning" showIcon message="Không tải được thông tin cửa hàng. Kiểm tra nội dung trước khi gửi." /> : null}
      <div className="order-zalo-share-modal__message">
        <label className="order-zalo-share-modal__label" htmlFor="order-zalo-message">
          Nội dung tin nhắn {isLoading ? '· đang tải thông tin cửa hàng…' : ''}
        </label>
        <Input.TextArea
          id="order-zalo-message"
          value={text}
          onChange={(event) => setEditedText(event.target.value)}
          autoSize={{ minRows: 5, maxRows: 10 }}
          maxLength={1000}
          showCount
        />
      </div>
      <p className="order-zalo-share-modal__hint"><InfoCircleOutlined /><span>Zalo mở theo số điện thoại của khách ở tab mới. Kiểm tra đúng người nhận, dán nội dung rồi bấm Gửi. Ứng dụng không gửi tin hoặc ghi nhận đã gửi.</span></p>
      </Modal>
    </>
  );
}
