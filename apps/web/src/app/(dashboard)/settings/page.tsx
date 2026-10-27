'use client';

import { CheckCircleOutlined, FileTextOutlined, InfoCircleOutlined, SaveOutlined, ShopOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { getErrorMessage, type StoreSettingInput, useSettingQuery, useUpdateSettingMutation } from '@/store/api';

const normalizePhone = (value: string | null | undefined): string | null => {
  const normalized = value?.replace(/[\s().-]/g, '') ?? '';
  return normalized || null;
};

export default function SettingsPage() {
  const [form] = Form.useForm<StoreSettingInput>();
  const watchedValues = Form.useWatch([], form);
  const [isDirty, setIsDirty] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { data: setting, isLoading, isError } = useSettingQuery();
  const [updateSetting, updateState] = useUpdateSettingMutation();

  useEffect(() => {
    if (!setting) return;
    form.setFieldsValue(setting);
    setIsDirty(false);
  }, [form, setting]);

  const save = async (values: StoreSettingInput): Promise<void> => {
    try {
      await updateSetting({ ...values, phone: normalizePhone(values.phone), invoiceTemplate: values.invoiceTemplate?.trim().toUpperCase() || null }).unwrap();
      setIsDirty(false);
      messageApi.success('Đã lưu thiết lập cửa hàng.');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };

  const preview = {
    storeName: watchedValues?.storeName || setting?.storeName || 'Cửa hàng kính mắt',
    phone: watchedValues?.phone ?? setting?.phone,
    address: watchedValues?.address ?? setting?.address,
    prefix: watchedValues?.invoiceTemplate ?? setting?.invoiceTemplate,
  };
  const previewCode = `${preview.prefix?.trim().toUpperCase() ? `${preview.prefix.trim().toUpperCase()}-` : ''}A1B2C3`;

  if (isLoading) return <div className="settings-loading"><Spin size="large" /></div>;

  return <div className="product-page settings-page">
    {contextHolder}
    <header className="product-page__hero settings-page__hero">
      <div><span className="product-page__eyebrow">THIẾT LẬP CỬA HÀNG</span><h1>Cài đặt</h1><p>Thông tin nhận diện và mã hiển thị trên phiếu đo mắt.</p></div>
      <Button className="product-create-button" type="primary" htmlType="submit" form="store-settings-form" icon={<SaveOutlined />} loading={updateState.isLoading} disabled={!isDirty}>Lưu thay đổi</Button>
    </header>
    {isError ? <Alert className="settings-error" type="error" showIcon message="Không thể tải cài đặt. Vui lòng tải lại trang." /> : null}
    <div className="settings-page__layout">
      <Card className="settings-form-card" styles={{ body: { padding: 0 } }}>
        <Form<StoreSettingInput> id="store-settings-form" form={form} layout="vertical" onFinish={save} onValuesChange={() => setIsDirty(true)} requiredMark="optional">
          <section className="settings-section">
            <div className="settings-section__heading"><span className="settings-section__icon"><ShopOutlined /></span><div><strong>Thông tin cửa hàng</strong><p>Dùng ở đầu phiếu đo và các điểm tiếp xúc với khách hàng.</p></div></div>
            <div className="settings-fields">
              <Form.Item name="storeName" label="Tên cửa hàng" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên cửa hàng.' }]}><Input maxLength={120} placeholder="Ví dụ: Kính mắt Minh Anh" /></Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ validator: (_, value: string | undefined) => { if (!value || /^(?:\+84|0)\d{9,10}$/.test(normalizePhone(value) ?? '')) return Promise.resolve(); return Promise.reject(new Error('Nhập số điện thoại Việt Nam hợp lệ.')); } }]}><Input inputMode="tel" maxLength={50} placeholder="Ví dụ: 0901 234 567" /></Form.Item>
              <Form.Item className="settings-fields__full" name="address" label="Địa chỉ"><Input.TextArea rows={3} maxLength={500} placeholder="Địa chỉ cửa hàng (không bắt buộc)" /></Form.Item>
            </div>
          </section>
          <section className="settings-section settings-section--last">
            <div className="settings-section__heading"><span className="settings-section__icon settings-section__icon--print"><FileTextOutlined /></span><div><strong>Phiếu đo mắt</strong><p>Thiết lập cách nhận diện phiếu khi gửi hoặc in cho khách.</p></div></div>
            <Form.Item name="invoiceTemplate" label="Tiền tố mã phiếu đo" extra="Ví dụ PM sẽ hiển thị thành PM-A1B2C3 trên phiếu. Để trống nếu không cần tiền tố."><Input maxLength={24} placeholder="Ví dụ: PM" /></Form.Item>
          </section>
        </Form>
      </Card>
      <aside className="settings-preview" aria-label="Xem trước thông tin trên phiếu đo">
        <div className="settings-preview__heading"><span><FileTextOutlined /></span><div><strong>Xem trước trên phiếu đo</strong><p>Nội dung cập nhật sau khi lưu.</p></div></div>
        <div className="settings-preview__paper"><span>PHÒNG KHÁM / CỬA HÀNG</span><h2>{preview.storeName}</h2><p>{[preview.address, preview.phone].filter(Boolean).join(' · ') || 'Địa chỉ · Số điện thoại'}</p><div><b>PHIẾU ĐO MẮT</b><strong>Mã: {previewCode}</strong></div></div>
        <p className="settings-preview__note"><InfoCircleOutlined /> Tiền tố được áp dụng khi mở xem trước hoặc in phiếu đo.</p>
      </aside>
      <div className="settings-saved-note"><CheckCircleOutlined /> Thông tin được lưu riêng cho cửa hàng này.</div>
    </div>
  </div>;
}
