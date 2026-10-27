'use client';

import { FileTextOutlined, PhoneOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Space, Spin, Switch, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage, type EyeExam, type EyeExamInput, type PrismBase, useCreateCustomerMutation, useCustomerQuery, useCustomersQuery } from '@/store/api';

type SubmitIntent = 'draft' | 'finalize';
type EyeExamFormValues = Omit<EyeExamInput, 'examDate'> & { examDate: Dayjs };
interface Props { open: boolean; exam?: EyeExam | null; customerId?: string; onClose: () => void; onSubmit: (values: EyeExamInput, intent: SubmitIntent) => Promise<void>; loading: boolean; }
interface QuickCustomerValues { name: string; phone: string; }
interface CustomerOption { id: string; name: string; phone: string; birthday?: string | null; address?: string | null; }

const rows = [
  { eye: 'OD', label: 'Mắt phải', cylinder: 'rCyl', fields: ['rSph', 'rCyl', 'rAxis', 'rAdd', 'rPd'] },
  { eye: 'OS', label: 'Mắt trái', cylinder: 'lCyl', fields: ['lSph', 'lCyl', 'lAxis', 'lAdd', 'lPd'] },
] as const;
const measurements = [
  { key: 'sph', label: 'SPH', unit: 'D', step: 0.25, min: -30, max: 30, precision: 2 },
  { key: 'cyl', label: 'CYL', unit: 'D', step: 0.25, min: -30, max: 30, precision: 2 },
  { key: 'axis', label: 'AXIS', unit: '°', step: 1, min: 0, max: 180, precision: 0 },
  { key: 'add', label: 'ADD', unit: 'D', step: 0.25, min: 0, max: 4, precision: 2 },
  { key: 'pd', label: 'PD đơn mắt', unit: 'mm', step: 0.5, min: 20, max: 80, precision: 2 },
] as const;
const advancedRows = [
  { eye: 'OD', label: 'Mắt phải', prism: 'rPrism', base: 'rBase', segHeight: 'rSegHeight' },
  { eye: 'OS', label: 'Mắt trái', prism: 'lPrism', base: 'lBase', segHeight: 'lSegHeight' },
] as const;
const prismBaseOptions: Array<{ value: PrismBase; label: string }> = [
  { value: 'BI', label: 'BI · Đáy trong' },
  { value: 'BO', label: 'BO · Đáy ngoài' },
  { value: 'BU', label: 'BU · Đáy trên' },
  { value: 'BD', label: 'BD · Đáy dưới' },
];

const hasCylinder = (value: unknown): boolean => typeof value === 'number' && value !== 0;
const hasPrism = (value: unknown): boolean => typeof value === 'number' && value !== 0;
const numberValue = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined;
const numberRule = (label: string, min: number, max: number, step?: number) => ({
  validator: async (_rule: unknown, value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value !== 'number' || value < min || value > max) throw new Error(`${label} phải từ ${min} đến ${max}.`);
    if (step && Math.abs(value / step - Math.round(value / step)) > 1e-8) throw new Error(`${label} nhập theo bước ${step}.`);
  },
});

export function EyeExamForm({ open, exam, customerId, onClose, onSubmit, loading }: Props) {
  const [form] = Form.useForm();
  const [quickCustomerForm] = Form.useForm<QuickCustomerValues>();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<CustomerOption>();
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [pdMode, setPdMode] = useState<'TOTAL' | 'MONOCULAR'>('TOTAL');
  const [messageApi, holder] = message.useMessage();
  const initialized = useRef(false);
  const pdModeChangeRequest = useRef(0);
  const errorClearRequest = useRef(0);
  const rCyl = Form.useWatch('rCyl', form);
  const lCyl = Form.useWatch('lCyl', form);
  const rSph = Form.useWatch('rSph', form);
  const lSph = Form.useWatch('lSph', form);
  const rPd = Form.useWatch('rPd', form);
  const lPd = Form.useWatch('lPd', form);
  const rPrism = Form.useWatch('rPrism', form);
  const lPrism = Form.useWatch('lPrism', form);
  const noPrescription = Form.useWatch('noPrescription', form);
  const searchTerm = q.trim();
  const debouncedSearchTerm = debouncedQ.trim();
  const isSearchingCustomers = searchTerm.length >= 2;
  const selectedCustomerId = exam?.customerId ?? customerId;
  const { data, isFetching: isFetchingCustomers } = useCustomersQuery(
    { q: debouncedSearchTerm, page: 1, pageSize: 20 },
    { skip: debouncedSearchTerm.length < 2 },
  );
  const { data: selectedCustomer } = useCustomerQuery(selectedCustomerId ?? '', {
    skip: !selectedCustomerId || Boolean(exam?.customer),
  });
  const [createCustomer, createCustomerState] = useCreateCustomerMutation();
  const warnings = useMemo(() => {
    const values = [numberValue(rSph), numberValue(lSph), numberValue(rCyl), numberValue(lCyl)];
    const result: string[] = [];
    if (values.some((value) => value !== undefined && Math.abs(value) >= 10)) result.push('Có độ khúc xạ từ 10.00D trở lên. Hãy đối chiếu lại phiếu hoặc kết quả đo trước khi lưu.');
    if (numberValue(rSph) !== undefined && numberValue(lSph) !== undefined && Math.abs(rSph - lSph) >= 2) result.push('SPH hai mắt chênh từ 2.00D. Hãy kiểm tra lại mắt và số liệu đã nhập.');
    if ([numberValue(rPd), numberValue(lPd)].some((value) => value !== undefined && value > 40)) result.push('PD trên 40 mm ở một mắt thường là PD tổng. Hãy kiểm tra lại và chọn đúng hình thức PD.');
    return result;
  }, [lCyl, lPd, lSph, rCyl, rPd, rSph]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    if (quickCustomerOpen) quickCustomerForm.resetFields();
  }, [quickCustomerForm, quickCustomerOpen]);
  useEffect(() => {
    if (open) setSelectedCustomerOption(exam?.customer ?? selectedCustomer);
  }, [exam?.customer, open, selectedCustomer]);
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    form.resetFields();
    form.setFieldsValue(exam ? {
      ...exam,
      examDate: dayjs(exam.examDate),
    } : {
      customerId,
      examDate: dayjs(),
      noPrescription: false,
    });
    setPdMode(exam && (exam.rPd !== null || exam.lPd !== null) ? 'MONOCULAR' : 'TOTAL');
    initialized.current = true;
  }, [customerId, exam, form, open]);

  const openQuickCustomer = (): void => {
    setQuickCustomerOpen(true);
  };
  const createQuickCustomer = async (values: QuickCustomerValues): Promise<void> => {
    try {
      const customer = await createCustomer(values).unwrap();
      form.setFieldsValue({ customerId: customer.id });
      setSelectedCustomerOption(customer);
      setQuickCustomerOpen(false);
      messageApi.success('Đã thêm và chọn khách hàng.');
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
  const customerOptions = useMemo(() => {
    const currentCustomer = selectedCustomerOption ?? exam?.customer ?? selectedCustomer;
    const searchResults = isSearchingCustomers ? (data?.items ?? []) : [];
    const customers = currentCustomer && !searchResults.some((customer) => customer.id === currentCustomer.id)
      ? [currentCustomer, ...searchResults]
      : searchResults;
    return customers.map((customer) => ({
      value: customer.id,
      label: `${customer.name} — ${customer.phone}`,
      customer,
    }));
  }, [data?.items, exam?.customer, isSearchingCustomers, selectedCustomer, selectedCustomerOption]);
  const scrollToField = (name: string | string[]): void => {
    window.requestAnimationFrame(() => form.scrollToField(name, { block: 'center', focus: true }));
  };
  const clearCompletionErrors = (names: string[]): void => {
    const request = ++errorClearRequest.current;
    window.requestAnimationFrame(() => {
      if (request !== errorClearRequest.current) return;
      form.setFields(names.map((name) => ({ name, errors: form.getFieldError(name).filter((error) => !/^(Cần nhập|Vui lòng nhập|Vui lòng nêu)/.test(error)) })));
    });
  };
  const clearFieldErrors = (names: string[]): void => {
    const request = ++errorClearRequest.current;
    window.requestAnimationFrame(() => {
      if (request !== errorClearRequest.current) return;
      form.setFields(names.map((name) => ({ name, errors: [] })));
    });
  };
  const changePdMode = (mode: 'TOTAL' | 'MONOCULAR'): void => {
    setPdMode(mode);
    const request = ++pdModeChangeRequest.current;
    window.requestAnimationFrame(() => {
      if (request !== pdModeChangeRequest.current) return;
      form.setFieldsValue(mode === 'TOTAL' ? { rPd: null, lPd: null } : { pdTotal: null });
      clearFieldErrors(['pdTotal', 'rPd', 'lPd']);
    });
  };
  const save = async (intent: SubmitIntent): Promise<void> => {
    let values: EyeExamFormValues;
    try {
      values = (intent === 'finalize'
        ? await form.validateFields()
        : { ...form.getFieldsValue(true), ...(await form.validateFields(['customerId', 'examDate'])) }) as EyeExamFormValues;
    } catch (error: unknown) {
      const fields = (error as { errorFields?: Array<{ name: string | string[] }> }).errorFields;
      const firstField = fields?.[0]?.name;
      if (firstField) scrollToField(firstField);
      return;
    }
    if (intent === 'finalize' && !values.noPrescription) {
      const missing = [
        ...(numberValue(values.rSph) === undefined ? [{ name: 'rSph', errors: ['Cần nhập SPH mắt phải trước khi chốt.'] }] : []),
        ...(numberValue(values.lSph) === undefined ? [{ name: 'lSph', errors: ['Cần nhập SPH mắt trái trước khi chốt.'] }] : []),
        ...(pdMode === 'TOTAL'
          ? numberValue(values.pdTotal) === undefined ? [{ name: 'pdTotal', errors: ['Vui lòng nhập PD tổng.'] }] : []
          : [
            ...(numberValue(values.rPd) === undefined ? [{ name: 'rPd', errors: ['Vui lòng nhập PD mắt phải.'] }] : []),
            ...(numberValue(values.lPd) === undefined ? [{ name: 'lPd', errors: ['Vui lòng nhập PD mắt trái.'] }] : []),
          ]),
      ];
      if (missing.length) {
        form.setFields(missing);
        scrollToField(missing[0].name);
        return;
      }
    }
    await onSubmit({ ...values, examDate: values.examDate.format('YYYY-MM-DD') }, intent);
  };
  const handleValuesChange = (changedValues: Record<string, unknown>): void => {
    clearCompletionErrors(Object.keys(changedValues));
    if (Object.hasOwn(changedValues, 'rCyl') && !hasCylinder(changedValues.rCyl)) form.setFieldValue('rAxis', null);
    if (Object.hasOwn(changedValues, 'lCyl') && !hasCylinder(changedValues.lCyl)) form.setFieldValue('lAxis', null);
    if (Object.hasOwn(changedValues, 'rPrism') && !hasPrism(changedValues.rPrism)) form.setFieldValue('rBase', null);
    if (Object.hasOwn(changedValues, 'lPrism') && !hasPrism(changedValues.lPrism)) form.setFieldValue('lBase', null);
    if (changedValues.noPrescription) {
      form.setFieldsValue({ rSph: null, rCyl: null, rAxis: null, rAdd: null, rPd: null, lSph: null, lCyl: null, lAxis: null, lAdd: null, lPd: null, pdTotal: null, rPrism: null, rBase: null, rSegHeight: null, lPrism: null, lBase: null, lSegHeight: null });
      clearFieldErrors(['rSph', 'rCyl', 'rAxis', 'rAdd', 'rPd', 'lSph', 'lCyl', 'lAxis', 'lAdd', 'lPd', 'pdTotal', 'rPrism', 'rBase', 'rSegHeight', 'lPrism', 'lBase', 'lSegHeight']);
    }
  };
  const hasAdvancedValues = Boolean(exam && (exam.rPrism !== null || exam.lPrism !== null || exam.rSegHeight !== null || exam.lSegHeight !== null));
  const close = (): void => {
    setQuickCustomerOpen(false);
    onClose();
  };
  const requestClose = (): void => {
    if (!form.isFieldsTouched()) {
      close();
      return;
    }
    Modal.confirm({
      title: 'Hủy phiếu đo đang nhập?',
      content: 'Những thay đổi chưa lưu sẽ bị mất.',
      okText: 'Hủy phiếu',
      okButtonProps: { danger: true },
      cancelText: 'Tiếp tục nhập',
      onOk: close,
    });
  };

  return <Modal
    className="eye-exam-modal"
    title={<div className="eye-exam-modal__heading"><span><FileTextOutlined /></span><div><em>PHIẾU ĐO MẮT</em><strong>{exam ? 'Chỉnh sửa phiếu đo' : 'Thêm phiếu đo mắt'}</strong><p>Ghi nhận kết quả đo để sử dụng cho đơn kính.</p></div></div>}
    open={open}
    centered
    onCancel={requestClose}
    width={800}
    footer={<div className="eye-exam-modal__footer"><span><b>*</b> Lưu nháp cần khách hàng và ngày đo. Chốt phiếu cần đủ thông số Rx.</span><Space size={10}><Button onClick={requestClose}>Hủy</Button><Button loading={loading} onClick={() => void save('draft')}>Lưu nháp</Button><Button className="eye-exam-modal__save" type="primary" loading={loading} onClick={() => void save('finalize')}>Chốt phiếu</Button></Space></div>}
  >
    {holder}
    <Form className="eye-exam-form" form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng.' }]}>
        <Select
          showSearch
          searchValue={q}
          filterOption={false}
          onSearch={setQ}
          onSelect={(value) => {
            setSelectedCustomerOption(customerOptions.find((option) => option.value === value)?.customer);
            setQ('');
          }}
          onOpenChange={(visible) => { if (!visible) setQ(''); }}
          options={customerOptions}
          optionRender={(option) => {
            const customer = option.data.customer as CustomerOption;
            return <div className="eye-exam-customer-option">
              <strong>{customer.name}</strong>
              <div className="eye-exam-customer-option__meta">
                <span className="eye-exam-customer-option__phone"><PhoneOutlined />{customer.phone}</span>
                {customer.birthday ? <span>{new Intl.DateTimeFormat('vi-VN').format(new Date(customer.birthday))}</span> : null}
                {customer.address ? <span>{customer.address}</span> : null}
              </div>
            </div>;
          }}
          listHeight={300}
          classNames={{ popup: { root: 'eye-exam-customer-select-dropdown' } }}
          placeholder="Nhập ít nhất 2 ký tự để tìm khách hàng"
          notFoundContent={
            searchTerm.length < 2
              ? <div className="eye-exam-customer-select__empty">Nhập tên hoặc số điện thoại để tìm khách hàng</div>
              : searchTerm !== debouncedSearchTerm || isFetchingCustomers
                ? <div className="eye-exam-customer-select__loading"><Spin size="small" /> Đang tìm khách hàng…</div>
                : <div className="eye-exam-customer-select__empty">Không tìm thấy khách hàng phù hợp</div>
          }
          popupRender={(menu) => <>
            <div className="eye-exam-customer-select__results">
              {isSearchingCustomers && !isFetchingCustomers && data ? `Tìm thấy ${data.total} khách hàng · hiển thị tối đa 20 kết quả` : 'Tìm khách hàng theo tên hoặc số điện thoại'}
            </div>
            {menu}
            <div className="eye-exam-customer-select__footer"><Button type="link" icon={<UserAddOutlined />} onClick={openQuickCustomer}>Thêm khách hàng nhanh</Button></div>
          </>}
        />
      </Form.Item>
      <div className="eye-exam-form__date">
        <Form.Item name="examDate" label="Ngày đo" rules={[{ required: true, message: 'Chọn ngày đo.' }]}><DatePicker format="DD/MM/YYYY" disabledDate={(current) => Boolean(current?.endOf('day').isAfter(dayjs().endOf('day')))} /></Form.Item>
      </div>

      <section className="eye-exam-form__recommendation">
        <div className="eye-exam-form__section-heading"><strong>Thông tin lắp kính</strong><span>Chọn nhu cầu để tư vấn và đối chiếu với đơn hàng.</span></div>
        <div className="eye-exam-form__recommendation-fields">
          <Form.Item name="wearingPurpose" label={<>Nhu cầu sử dụng <span className="eye-exam-form__optional">(không bắt buộc)</span></>}><Select allowClear placeholder="Chọn nhu cầu" options={[{ value: 'DISTANCE', label: 'Nhìn xa' }, { value: 'NEAR', label: 'Đọc gần' }, { value: 'INTERMEDIATE', label: 'Máy tính / trung gian' }, { value: 'MULTIPURPOSE', label: 'Đa mục đích' }]} /></Form.Item>
          <Form.Item name="lensDesign" label={<>Thiết kế tròng <span className="eye-exam-form__optional">(không bắt buộc)</span></>}><Select allowClear placeholder="Chọn loại tròng" options={[{ value: 'SINGLE_VISION', label: 'Tròng đơn' }, { value: 'BIFOCAL', label: 'Hai tròng' }, { value: 'PROGRESSIVE', label: 'Đa tròng' }]} /></Form.Item>
        </div>
        <div className="eye-exam-form__no-rx"><Form.Item name="noPrescription" valuePropName="checked" noStyle><Switch size="small" /></Form.Item><span>Không kê đơn kính cho lần đo này</span></div>
        {noPrescription ? <Form.Item name="noPrescriptionReason" label="Lý do không kê đơn" rules={[{ required: true, whitespace: true, message: 'Vui lòng nêu lý do.' }]}><Input.TextArea rows={2} maxLength={500} showCount placeholder="Ví dụ: chưa cần điều chỉnh hoặc cần chuyển khám chuyên khoa" /></Form.Item> : null}
      </section>

      <section className="eye-exam-form__prescription" aria-labelledby="rx-heading">
        <div className="eye-exam-form__section-heading"><strong id="rx-heading">Thông số khúc xạ</strong><span>SPH, CYL và ADD theo diop (D); AXIS theo độ (°). PD được nhập riêng cho từng mắt (mm).</span></div>
        <div className="eye-exam-form__pd-mode"><div className="eye-exam-form__pd-choice"><span>Hình thức PD</span><Radio.Group value={pdMode} disabled={noPrescription} onChange={(event) => changePdMode(event.target.value as 'TOTAL' | 'MONOCULAR')}><Radio value="TOTAL">PD tổng</Radio><Radio value="MONOCULAR">PD đơn mắt</Radio></Radio.Group></div>{pdMode === 'TOTAL' ? <Form.Item name="pdTotal" label="PD tổng (mm)" rules={[numberRule('PD tổng', 40, 80, 0.5)]}><InputNumber disabled={noPrescription} changeOnWheel={false} step={0.5} precision={1} placeholder="Ví dụ: 60" /></Form.Item> : null}</div>
        <div className="eye-exam-form__table-wrap"><table className="eye-exam-form__table"><thead><tr><th>Mắt</th>{(pdMode === 'MONOCULAR' ? measurements : measurements.slice(0, 4)).map((measurement) => <th key={measurement.key}>{measurement.label}<small>{measurement.unit}{measurement.key === 'pd' ? ' / mắt' : ''}</small></th>)}</tr></thead><tbody>{rows.map((row) => {
          const cylinder = row.eye === 'OD' ? rCyl : lCyl;
          return <tr key={row.eye}><th scope="row"><strong>{row.eye}</strong><span>{row.label}</span></th>{row.fields.slice(0, pdMode === 'MONOCULAR' ? 5 : 4).map((name, index) => {
            const measurement = measurements[index];
            const axis = measurement.key === 'axis';
            return <td key={name}><Form.Item name={name} dependencies={axis ? [row.cylinder] : undefined} rules={[numberRule(`${row.eye} ${measurement.label}`, measurement.min, measurement.max, measurement.step), ...(axis ? [{ validator: async (_rule: unknown, value: unknown) => { if (hasCylinder(form.getFieldValue(row.cylinder)) && (value === undefined || value === null)) throw new Error(`Nhập AXIS cho ${row.eye} khi có CYL.`); } }] : [])]}>
              <InputNumber aria-label={`${row.label} ${measurement.label} (${measurement.unit})`} style={{ width: '100%' }} changeOnWheel={false} step={measurement.step} precision={measurement.precision} disabled={noPrescription || (axis && !hasCylinder(cylinder))} placeholder={axis && !hasCylinder(cylinder) ? 'Không áp dụng' : undefined} />
            </Form.Item></td>;
          })}</tr>;
        })}</tbody></table></div>
        <p className="eye-exam-form__hint">AXIS chỉ áp dụng khi CYL khác 0. Chọn một cách nhập PD: PD tổng hoặc PD đơn mắt.</p>
        {warnings.length ? <Alert className="eye-exam-form__warnings" type="warning" showIcon message="Kiểm tra lại thông số trước khi lưu" description={<ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>} /> : null}
      </section>
      {!noPrescription ? <Collapse key={exam?.id ?? 'new'} className="eye-exam-form__advanced" defaultActiveKey={hasAdvancedValues ? ['advanced'] : []} items={[{
        key: 'advanced',
        label: 'Thông số lắp tròng nâng cao',
        children: <><p className="eye-exam-form__advanced-hint">Chỉ nhập khi đơn có Prism hoặc cần xác định chiều cao lắp tròng. Các thông số này sẽ được in và khóa vào đơn hàng.</p><div className="eye-exam-form__advanced-grid">{advancedRows.map((row) => {
          const prism = row.eye === 'OD' ? rPrism : lPrism;
          return <section className="eye-exam-form__advanced-eye" key={row.eye}><strong>{row.eye} · {row.label}</strong><div className="eye-exam-form__advanced-fields">
            <Form.Item name={row.prism} label="Prism (Δ)" rules={[numberRule(`${row.eye} Prism`, 0, 20, 0.25)]}><InputNumber changeOnWheel={false} step={0.25} precision={2} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name={row.base} label="Base" dependencies={[row.prism]} rules={[{ validator: async (_rule, value) => { if (hasPrism(form.getFieldValue(row.prism)) && !value) throw new Error(`Chọn BASE cho ${row.eye} khi có Prism.`); } }]}><Select allowClear disabled={!hasPrism(prism)} placeholder={hasPrism(prism) ? 'Chọn hướng đáy' : 'Không áp dụng'} options={prismBaseOptions} /></Form.Item>
            <Form.Item name={row.segHeight} label="Cao lắp tròng (mm)" rules={[numberRule(`${row.eye} cao lắp tròng`, 5, 50, 0.5)]}><InputNumber changeOnWheel={false} step={0.5} precision={1} style={{ width: '100%' }} /></Form.Item>
          </div></section>;
        })}</div></>,
      }]} /> : null}
      <Form.Item className="eye-exam-form__note" name="note" label="Ghi chú"><Input.TextArea maxLength={2000} placeholder="Lưu ý về tình trạng mắt hoặc tư vấn cho khách..." rows={4} showCount /></Form.Item>
    </Form>
    <Modal
      className="quick-customer-modal"
      open={quickCustomerOpen}
      centered
      destroyOnHidden
      title={<div className="quick-customer-modal__heading"><span><UserAddOutlined /></span><div><strong>Thêm khách hàng nhanh</strong><p>Chỉ cần thông tin liên hệ để bắt đầu phiếu đo.</p></div></div>}
      onCancel={() => setQuickCustomerOpen(false)}
      footer={<Space size={10}><Button onClick={() => setQuickCustomerOpen(false)}>Hủy</Button><Button type="primary" loading={createCustomerState.isLoading} onClick={() => void quickCustomerForm.submit()}>Tạo và chọn khách</Button></Space>}
    >
      <Form<QuickCustomerValues> className="quick-customer-modal__form" form={quickCustomerForm} layout="vertical" onFinish={createQuickCustomer}>
        <Form.Item name="name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên.' }]}>
          <Input autoFocus autoComplete="name" maxLength={120} placeholder="Nguyễn Văn A" prefix={<UserOutlined />} />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại.' }, { pattern: /^[+\d.\-\s()]+$/, message: 'Số điện thoại không hợp lệ.' }]}>
          <Input autoComplete="tel" inputMode="tel" maxLength={30} placeholder="0901 234 567" prefix={<PhoneOutlined />} type="tel" />
        </Form.Item>
        <p>Ngày sinh, địa chỉ và ghi chú có thể bổ sung sau trong hồ sơ khách hàng.</p>
      </Form>
    </Modal>
  </Modal>;
}
