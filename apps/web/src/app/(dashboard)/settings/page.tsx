'use client';

import { SaveOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, InputNumber, Space, Spin, message } from 'antd';
import { useEffect } from 'react';
import {
  getErrorMessage,
  type StoreSettingInput,
  useSettingQuery,
  useUpdateSettingMutation,
} from '@/store/api';

export default function SettingsPage() {
  const [form] = Form.useForm<StoreSettingInput>();
  const [messageApi, contextHolder] = message.useMessage();
  const { data: setting, isLoading, isError } = useSettingQuery();
  const [updateSetting, updateState] = useUpdateSettingMutation();

  useEffect(() => {
    if (setting) form.setFieldsValue(setting);
  }, [form, setting]);

  const save = async (values: StoreSettingInput): Promise<void> => {
    try {
      await updateSetting(values).unwrap();
      messageApi.success('Đã lưu cài đặt cửa hàng.');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  if (isLoading) return <Spin size="large" />;

  return (
    <>
      {contextHolder}
      <div className="page-heading">
        <div>
          <h1>Cài đặt</h1>
          <p>Thông tin hiển thị khi in phiếu đo và lịch nhắc tái khám.</p>
        </div>
      </div>
      <Card className="surface-card" title="Thông tin cửa hàng" style={{ maxWidth: 760 }}>
        {isError && <Alert type="error" showIcon message="Không thể tải cài đặt. Vui lòng tải lại trang." style={{ marginBottom: 20 }} />}
        <Form<StoreSettingInput> form={form} layout="vertical" onFinish={save} requiredMark="optional">
          <Form.Item
            name="storeName"
            label="Tên cửa hàng"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên cửa hàng.' }]}
          >
            <Input maxLength={120} placeholder="Cửa hàng kính mắt" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input maxLength={50} placeholder="Ví dụ: 0901 234 567" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={3} maxLength={500} placeholder="Địa chỉ cửa hàng (không bắt buộc)" />
          </Form.Item>
          <Form.Item name="invoiceTemplate" label="Mẫu/số hiệu phiếu in">
            <Input maxLength={120} placeholder="Ví dụ: PM-01 (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Nhắc tái khám sau" extra="Dùng làm ngày nhắc mặc định khi tạo phiếu đo mới.">
            <Space.Compact>
              <Form.Item
                name="reminderMonths"
                noStyle
                rules={[{ required: true, message: 'Vui lòng nhập số tháng.' }]}
              >
                <InputNumber min={1} max={60} precision={0} style={{ width: 120 }} />
              </Form.Item>
              <Input value="tháng" readOnly style={{ width: 76, textAlign: 'center' }} />
            </Space.Compact>
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={updateState.isLoading}>
            Lưu cài đặt
          </Button>
        </Form>
      </Card>
    </>
  );
}
