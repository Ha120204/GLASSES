'use client';

import { CopyOutlined, ExportOutlined, MessageOutlined, PhoneOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Modal, message } from 'antd';
import { useState } from 'react';
import { createOrderZaloMessage } from '@/lib/order-zalo-message';
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
      title={<span><MessageOutlined /> Chuẩn bị tin Zalo</span>}
      onCancel={onClose}
      footer={
        <div className="order-zalo-share-modal__footer">
          <Button onClick={onClose}>Đóng</Button>
          <Button icon={<CopyOutlined />} disabled={isLoading || !text.trim()} onClick={() => void copy(text, 'Đã sao chép nội dung tin nhắn.')}>
            Sao chép tin
          </Button>
          <Button
            type="primary"
            href="https://chat.zalo.me/"
            target="_blank"
            rel="noopener noreferrer"
            icon={<ExportOutlined />}
            disabled={isLoading || !text.trim()}
            onClick={() => void copy(text, 'Đã sao chép tin. Tìm đúng khách trong Zalo rồi dán và gửi.')}
          >
            Sao chép tin & mở Zalo
          </Button>
        </div>
      }
    >
      <div className="order-zalo-share-modal__recipient">
        <div>
          <span>Khách nhận</span>
          <strong>{order.customer.name}</strong>
          <span>{order.customer.phone}</span>
        </div>
        <Button icon={<PhoneOutlined />} onClick={() => void copy(order.customer.phone, 'Đã sao chép số điện thoại khách.')}>
          Sao chép SĐT
        </Button>
      </div>
      {isError ? <Alert type="warning" showIcon message="Không tải được thông tin cửa hàng. Kiểm tra nội dung trước khi gửi." /> : null}
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
      <p className="order-zalo-share-modal__hint">
        Zalo mở ở tab mới. Tìm đúng khách bằng số điện thoại, dán nội dung và tự bấm Gửi.
        Ứng dụng không gửi tin hoặc ghi nhận đã gửi.
      </p>
      </Modal>
    </>
  );
}
