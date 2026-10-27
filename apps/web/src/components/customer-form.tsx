'use client';

import {
  CalendarOutlined,
  IdcardOutlined,
  PhoneOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Space } from 'antd';
import { useEffect } from 'react';
import type { Customer, CustomerInput } from '@/store/api';

interface CustomerFormProps {
  open: boolean;
  customer?: Customer | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: CustomerInput) => Promise<void>;
}

export function CustomerForm({ open, customer, loading, onClose, onSubmit }: CustomerFormProps) {
  const [form] = Form.useForm<CustomerInput>();
  const isEditing = Boolean(customer);
  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        customer
          ? {
              name: customer.name,
              phone: customer.phone,
              birthday: customer.birthday?.slice(0, 10),
              gender: customer.gender ?? undefined,
              address: customer.address ?? undefined,
              note: customer.note ?? undefined,
            }
          : { name: '', phone: '' },
      );
    }
  }, [customer, form, open]);

  return (
    <Modal
      className="customer-form-modal"
      title={
        <div className="customer-form-modal__heading">
          <span className="customer-form-modal__heading-icon" aria-hidden="true">
            {isEditing ? <UserOutlined /> : <UserAddOutlined />}
          </span>
          <div>
            <span className="customer-form-modal__eyebrow">HỒ SƠ KHÁCH HÀNG</span>
            <strong>{isEditing ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}</strong>
            <p>{isEditing ? 'Cập nhật thông tin liên hệ và ghi chú.' : 'Tạo hồ sơ để quản lý đơn hàng và lịch sử đo mắt.'}</p>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      centered
      width={680}
      destroyOnHidden
      footer={
        <div className="customer-form-modal__footer">
          <span><b>*</b> Trường thông tin cần thiết</span>
          <Space size={10}>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={loading} onClick={() => void form.submit()}>
              {isEditing ? 'Lưu thay đổi' : 'Tạo khách hàng'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form<CustomerInput>
        className="customer-form-modal__form"
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        requiredMark={(label, { required }) => (
          <>
            {label}
            <span className="customer-form-modal__field-status">
              {required ? ' (bắt buộc)' : ' (không bắt buộc)'}
            </span>
          </>
        )}
      >
        <section className="customer-form-modal__section customer-form-modal__section--primary">
          <div className="customer-form-modal__section-heading">
            <span className="customer-form-modal__section-icon"><IdcardOutlined /></span>
            <div>
              <strong>Thông tin liên hệ</strong>
              <span>Dùng để nhận diện và tìm nhanh khách hàng.</span>
            </div>
          </div>
          <div className="customer-form-modal__grid customer-form-modal__grid--contact">
            <Form.Item
              name="name"
              label="Họ và tên"
              rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên.' }]}
            >
              <Input autoComplete="name" maxLength={120} placeholder="Nguyễn Văn A" prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[
                { required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại.' },
                { pattern: /^[+\d.\-\s()]+$/, message: 'Số điện thoại không hợp lệ.' },
              ]}
            >
              <Input
                autoComplete="tel"
                inputMode="tel"
                maxLength={30}
                placeholder="0901 234 567"
                prefix={<PhoneOutlined />}
                type="tel"
              />
            </Form.Item>
          </div>
        </section>

        <section className="customer-form-modal__section customer-form-modal__section--details">
          <div className="customer-form-modal__section-heading">
            <span className="customer-form-modal__section-icon"><CalendarOutlined /></span>
            <div>
              <strong>Thông tin bổ sung</strong>
              <span>Có thể bổ sung khi khách hàng cung cấp.</span>
            </div>
          </div>
          <div className="customer-form-modal__grid">
            <Form.Item name="birthday" label="Ngày sinh">
              <Input max={new Date().toISOString().slice(0, 10)} type="date" />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính">
              <Select
                allowClear
                placeholder="Chọn giới tính"
                options={[
                  { value: 'MALE', label: 'Nam' },
                  { value: 'FEMALE', label: 'Nữ' },
                  { value: 'OTHER', label: 'Khác' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea autoComplete="street-address" maxLength={500} placeholder="Số nhà, đường, phường/xã, quận/huyện..." rows={2} showCount />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea maxLength={2000} placeholder="Ví dụ: ưu tiên liên hệ ngoài giờ hành chính..." rows={3} showCount />
          </Form.Item>
        </section>
      </Form>
    </Modal>
  );
}
