'use client';
import { Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { getErrorMessage, type Customer, type EyeExam, type EyeExamInput, useCreateCustomerMutation, useCustomersQuery, useEyeExamConfigQuery } from '@/store/api';

interface Props { open: boolean; exam?: EyeExam | null; customerId?: string; onClose: () => void; onSubmit: (values: EyeExamInput) => Promise<void>; loading: boolean; }
const fields = [['rSph','rCyl','rAxis','rAdd','rPd'], ['lSph','lCyl','lAxis','lAdd','lPd']] as const;
const labels = ['SPH','CYL','AXIS','ADD','PD'];
export function EyeExamForm({ open, exam, customerId, onClose, onSubmit, loading }: Props) {
  const [form] = Form.useForm(); const [q, setQ] = useState(''); const [debouncedQ, setDebouncedQ] = useState(''); const [messageApi, holder] = message.useMessage();
  const { data } = useCustomersQuery({ q: debouncedQ || undefined, page: 1, pageSize: 20 }); const { data: config } = useEyeExamConfigQuery(); const [createCustomer] = useCreateCustomerMutation();
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedQ(q), 300); return () => window.clearTimeout(timer); }, [q]);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue(exam ? { ...exam, examDate: dayjs(exam.examDate), nextReminderDate: exam.nextReminderDate ? dayjs(exam.nextReminderDate) : undefined } : { customerId, examDate: dayjs(), nextReminderDate: dayjs().add(config?.reminderMonths ?? 12, 'month') }); } }, [open, exam, customerId, config?.reminderMonths, form]);
  const quickCustomer = async (): Promise<void> => { const name = window.prompt('Tên khách hàng mới:'); const phone = window.prompt('Số điện thoại:'); if (!name || !phone) return; try { const customer = await createCustomer({ name, phone }).unwrap(); form.setFieldsValue({ customerId: customer.id }); messageApi.success('Đã thêm và chọn khách hàng.'); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  const save = async (): Promise<void> => { const values = await form.validateFields(); await onSubmit({ ...values, examDate: values.examDate.format('YYYY-MM-DD'), nextReminderDate: values.nextReminderDate?.format('YYYY-MM-DD') }); };
  return <Drawer title={exam ? 'Sửa phiếu đo mắt' : 'Thêm phiếu đo mắt'} open={open} onClose={onClose} width={680} extra={<Space><Button onClick={onClose}>Hủy</Button><Button type="primary" loading={loading} onClick={() => void save()}>Lưu phiếu</Button></Space>}>
    {holder}<Form form={form} layout="vertical"><Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng.' }]}><Select showSearch filterOption={false} onSearch={setQ} options={data?.items.map((c: Customer) => ({ value: c.id, label: `${c.name} — ${c.phone}` }))} popupRender={(menu) => <>{menu}<Button type="link" onClick={() => void quickCustomer()}>+ Thêm khách hàng nhanh</Button></>} /></Form.Item>
    <Space wrap><Form.Item name="examDate" label="Ngày đo" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" /></Form.Item><Form.Item name="nextReminderDate" label="Nhắc tái khám"><DatePicker format="DD/MM/YYYY" /></Form.Item><Form.Item name="examiner" label="Người đo"><Input /></Form.Item></Space>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 560 }}><thead><tr><th>Mắt</th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{fields.map((row, index) => <tr key={row[0]}><td><b>{index === 0 ? 'OD (Phải)' : 'OS (Trái)'}</b></td>{row.map((name, col) => <td key={name}><Form.Item name={name} style={{ margin: 4 }}><InputNumber style={{ width: 90 }} step={col === 2 ? 1 : 0.25} min={col === 2 ? 0 : col === 3 ? 0 : col === 4 ? 20 : -30} max={col === 2 ? 180 : col === 3 ? 4 : col === 4 ? 80 : 30} precision={col === 2 ? 0 : 2} /></Form.Item></td>)}</tr>)}</tbody></table></div>
    <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={4} /></Form.Item></Form>
  </Drawer>;
}
