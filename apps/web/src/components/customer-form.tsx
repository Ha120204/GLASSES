'use client';

import { Drawer, Form, Input, Select, Space, Button } from 'antd';
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
    <Drawer
      title={customer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" loading={loading} onClick={() => void form.submit()}>
            Lưu
          </Button>
        </Space>
      }
    >
      <Form<CustomerInput>
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        requiredMark="optional"
      >
        <Form.Item
          name="name"
          label="Họ và tên"
          rules={[{ required: true, message: 'Vui lòng nhập họ tên.' }]}
        >
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[{ required: true, message: 'Vui lòng nhập số điện thoại.' }]}
        >
          <Input placeholder="0901 234 567" />
        </Form.Item>
        <Form.Item name="birthday" label="Ngày sinh">
          <Input type="date" />
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
        <Form.Item name="address" label="Địa chỉ">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={4} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
