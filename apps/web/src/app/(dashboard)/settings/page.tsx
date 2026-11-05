'use client';

import { BankOutlined, CheckCircleOutlined, FileTextOutlined, InfoCircleOutlined, SaveOutlined, ShopOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Select, Spin, Switch, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { vietQrBanks } from '@/lib/vietqr-banks';
import { SETTINGS_BEFORE_LEAVE_EVENT } from '@/lib/settings-navigation';
import { getErrorMessage, type StoreSettingInput, useSettingQuery, useUpdateSettingMutation } from '@/store/api';

const normalizePhone = (value: string | null | undefined): string | null => {
  const normalized = value?.replace(/[\s().-]/g, '') ?? '';
  return normalized || null;
};

const normalizeDigits = (value: string | null | undefined): string => value?.replace(/\D/g, '') ?? '';
const bankOptions = vietQrBanks.map((bank) => ({
  value: bank.bin,
  label: `${bank.shortName} — ${bank.name} · ${bank.bin}`,
}));

export default function SettingsPage() {
  const [form] = Form.useForm<StoreSettingInput>();
  const watchedValues = Form.useWatch([], form);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const [messageApi, contextHolder] = message.useMessage();
  const { data: setting, isLoading, isFetching, isError, refetch } = useSettingQuery();
  const [updateSetting, updateState] = useUpdateSettingMutation();
  const qrPaymentEnabled = watchedValues?.qrPaymentEnabled ?? setting?.qrPaymentEnabled ?? false;
  const selectBank = (bankBin: string): void => {
    const bank = vietQrBanks.find((item) => item.bin === bankBin);
    if (!bank) return;
    form.setFieldsValue({ bankBin: bank.bin, bankName: bank.name });
    setIsDirty(true);
  };

  useEffect(() => {
    if (!setting || isDirtyRef.current) return;
    form.setFieldsValue(setting);
    setIsDirty(false);
  }, [form, setting]);

  useEffect(() => {
    const guardKey = '__settingsLeaveGuard';
    const currentState = window.history.state as Record<string, unknown> | null;
    if (!currentState?.[guardKey]) {
      window.history.pushState({ ...currentState, [guardKey]: true }, '', window.location.href);
    }

    const warning = 'Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?';
    let leaveConfirmed = false;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (leaveConfirmed || !isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeLeave = (event: Event): void => {
      if (isDirtyRef.current && !window.confirm(warning)) event.preventDefault();
    };
    let leavingViaHistory = false;
    let resetHistoryGuard: number | undefined;
    const onPopState = (event: PopStateEvent): void => {
      if (leavingViaHistory || (event.state as Record<string, unknown> | null)?.[guardKey]) return;
      if (isDirtyRef.current && !window.confirm(warning)) {
        window.history.pushState({ ...window.history.state, [guardKey]: true }, '', window.location.href);
        return;
      }
      leavingViaHistory = true;
      leaveConfirmed = true;
      window.history.back();
      resetHistoryGuard = window.setTimeout(() => {
        leavingViaHistory = false;
        leaveConfirmed = false;
      }, 1000);
    };

    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener(SETTINGS_BEFORE_LEAVE_EVENT, beforeLeave);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.clearTimeout(resetHistoryGuard);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener(SETTINGS_BEFORE_LEAVE_EVENT, beforeLeave);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const save = async (values: StoreSettingInput): Promise<void> => {
    if (updateState.isLoading) return;
    const settingValues = { ...values };
    delete settingValues.transferContentPrefix;
    try {
      await updateSetting({
        ...settingValues,
        storeName: values.storeName?.trim(),
        phone: normalizePhone(values.phone),
        invoiceTemplate: values.invoiceTemplate?.trim().toUpperCase() || null,
        bankName: values.bankName?.trim() || null,
        bankBin: normalizeDigits(values.bankBin) || null,
        bankAccountNumber: normalizeDigits(values.bankAccountNumber) || null,
        bankAccountName: values.bankAccountName?.trim().toUpperCase() || null,
      }).unwrap();
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
  const previewCode = `${preview.prefix?.trim().toUpperCase() || 'PD'}-000001`;

  if (isLoading || (isFetching && !setting)) return <div className="settings-loading"><Spin size="large" /><span>Đang tải cài đặt…</span></div>;

  const retryAction = <Button size="small" loading={isFetching} onClick={() => void refetch()}>Thử lại</Button>;
  if (!setting) return <div className="settings-error-state"><Alert type="error" showIcon message="Không thể tải cài đặt cửa hàng." description="Hãy thử tải lại trước khi chỉnh sửa." action={retryAction} /></div>;

  return <div className="product-page settings-page">
    {contextHolder}
    <header className="product-page__hero settings-page__hero">
      <div><span className="product-page__eyebrow">THIẾT LẬP CỬA HÀNG</span><h1>Cài đặt</h1><p>Cập nhật thông tin cửa hàng, tiền tố mã phiếu đo và tài khoản nhận thanh toán QR.</p></div>
      <Button className="product-create-button" type="primary" htmlType="submit" form="store-settings-form" icon={<SaveOutlined />} loading={updateState.isLoading} disabled={!isDirty}>Lưu thay đổi</Button>
    </header>
    {isError ? <Alert className="settings-error" type="error" showIcon message="Không thể cập nhật cài đặt từ máy chủ." description="Dữ liệu đang hiển thị có thể chưa phải bản mới nhất." action={retryAction} /> : null}
    <div className="settings-page__layout">
      <Card className="settings-form-card" styles={{ body: { padding: 0 } }}>
        <Form<StoreSettingInput> id="store-settings-form" form={form} layout="vertical" onFinish={save} onValuesChange={(changedValues) => {
          setIsDirty(true);
          if ('qrPaymentEnabled' in changedValues) {
            void form.validateFields(['bankAccountNumber', 'bankAccountName', 'bankBin']).catch(() => undefined);
          }
        }} requiredMark="optional">
          <section className="settings-section">
            <div className="settings-section__heading"><span className="settings-section__icon"><ShopOutlined /></span><div><strong>Thông tin cửa hàng</strong><p>Dùng ở đầu phiếu đo và các điểm tiếp xúc với khách hàng.</p></div></div>
            <div className="settings-fields">
              <Form.Item name="storeName" label="Tên cửa hàng" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên cửa hàng.' }]}><Input maxLength={120} placeholder="Ví dụ: Kính mắt Minh Anh" /></Form.Item>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ validator: (_, value: string | undefined) => { if (!value || /^(?:\+84|0)\d{9,10}$/.test(normalizePhone(value) ?? '')) return Promise.resolve(); return Promise.reject(new Error('Nhập số điện thoại Việt Nam hợp lệ.')); } }]}><Input inputMode="tel" maxLength={50} placeholder="Ví dụ: 0901 234 567" /></Form.Item>
              <Form.Item className="settings-fields__full" name="address" label="Địa chỉ"><Input.TextArea rows={3} maxLength={500} placeholder="Địa chỉ cửa hàng (không bắt buộc)" /></Form.Item>
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section__heading"><span className="settings-section__icon settings-section__icon--print"><FileTextOutlined /></span><div><strong>Phiếu đo mắt</strong><p>Thiết lập cách nhận diện phiếu khi gửi hoặc in cho khách.</p></div></div>
              <Form.Item name="invoiceTemplate" label="Tiền tố mã phiếu đo" extra="Ví dụ PM tạo mã PM-000001. Để trống sẽ dùng PD. Đổi tiền tố chỉ áp dụng cho phiếu tạo sau." rules={[{ validator: (_, value: string | undefined) => !value?.trim() || /^[A-Z0-9-]{1,24}$/.test(value.trim().toUpperCase()) ? Promise.resolve() : Promise.reject(new Error('Tiền tố chỉ gồm chữ in hoa, số và dấu gạch ngang.')) }]}><Input maxLength={24} placeholder="Ví dụ: PM" /></Form.Item>
          </section>
          <section className="settings-section settings-section--last">
            <div className="settings-section__heading"><span className="settings-section__icon"><BankOutlined /></span><div><strong>Nhận thanh toán qua QR</strong><p>Thông tin này sẽ được dùng để tạo mã VietQR khi thu tiền đơn hàng.</p></div></div>
            <Form.Item name="qrPaymentEnabled" valuePropName="checked" label="Bật thanh toán qua QR" extra={qrPaymentEnabled ? 'Điền đủ thông tin ngân hàng, kiểm tra tài khoản, rồi lưu để bật QR.' : 'Chỉ bật sau khi đã kiểm tra đúng tài khoản nhận tiền.'}><Switch checkedChildren="Bật" unCheckedChildren="Tắt" /></Form.Item>
            <div className="settings-fields">
              <Form.Item name="bankName" hidden><Input /></Form.Item>
              <Form.Item name="bankAccountNumber" label="Số tài khoản" required={qrPaymentEnabled} normalize={normalizeDigits} dependencies={['qrPaymentEnabled']} validateTrigger="onBlur" rules={[{ validator: (_, value: string | undefined) => !form.getFieldValue('qrPaymentEnabled') || /^\d{6,30}$/.test(value ?? '') ? Promise.resolve() : Promise.reject(new Error('Nhập số tài khoản từ 6 đến 30 chữ số.')) }]}><Input disabled={!qrPaymentEnabled} inputMode="numeric" maxLength={30} placeholder="Chỉ nhập chữ số" /></Form.Item>
              <Form.Item name="bankAccountName" label="Tên chủ tài khoản" required={qrPaymentEnabled} dependencies={['qrPaymentEnabled']} validateTrigger="onBlur" rules={[{ validator: (_, value: string | undefined) => !form.getFieldValue('qrPaymentEnabled') || value?.trim() ? Promise.resolve() : Promise.reject(new Error('Nhập tên chủ tài khoản.')) }]}><Input disabled={!qrPaymentEnabled} maxLength={120} placeholder="Ví dụ: NGUYEN VAN A" /></Form.Item>
              <Form.Item name="bankBin" label="Ngân hàng nhận tiền" required={qrPaymentEnabled} dependencies={['qrPaymentEnabled']} validateTrigger="onChange" rules={[{ validator: (_, value: string | undefined) => !form.getFieldValue('qrPaymentEnabled') || vietQrBanks.some((bank) => bank.bin === value) ? Promise.resolve() : Promise.reject(new Error('Chọn ngân hàng nhận tiền.')) }]} extra="Gõ tên, tên viết tắt hoặc mã BIN để tìm; hệ thống tự lưu đúng mã VietQR."><Select disabled={!qrPaymentEnabled} showSearch optionFilterProp="label" options={bankOptions} placeholder="Tìm và chọn ngân hàng" onChange={(value) => selectBank(String(value))} notFoundContent="Không tìm thấy ngân hàng phù hợp." /></Form.Item>
            </div>
          </section>
        </Form>
      </Card>
      <aside className="settings-preview" aria-label="Xem trước thông tin trên phiếu đo">
        <div className="settings-preview__heading"><span><FileTextOutlined /></span><div><strong>Xem trước trên phiếu đo</strong><p>{isDirty ? 'Mẫu theo thay đổi chưa lưu.' : 'Mẫu theo cài đặt đã lưu.'}</p></div></div>
        <div className="settings-preview__paper"><span>PHÒNG KHÁM / CỬA HÀNG</span><h2>{preview.storeName}</h2><p>{[preview.address, preview.phone].filter(Boolean).join(' · ') || 'Địa chỉ · Số điện thoại'}</p><div><b>PHIẾU ĐO MẮT</b><strong>Mã ví dụ: {previewCode}</strong></div></div>
        <p className="settings-preview__note"><InfoCircleOutlined /> Tiền tố được lưu vào mã khi tạo phiếu; mã phiếu cũ không đổi.</p>
      </aside>
      <div className={`settings-saved-note${isDirty ? ' settings-saved-note--dirty' : ''}`} aria-live="polite">{isDirty ? <><InfoCircleOutlined /> Các thay đổi trên trang chưa được lưu.</> : <><CheckCircleOutlined /> Thông tin đã được lưu cho cửa hàng này.</>}</div>
    </div>
  </div>;
}
