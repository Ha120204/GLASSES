'use client';

import { DownloadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Table, Upload, message, type TableColumnsType, type UploadProps } from 'antd';
import { useState } from 'react';
import { getErrorMessage, type EyeExamImportIssue, type EyeExamImportPreview, useImportEyeExamsMutation, usePreviewEyeExamImportMutation } from '@/store/api';

interface Props { open: boolean; onClose: () => void; }
const issueColumns: TableColumnsType<EyeExamImportIssue> = [{ title: 'Dòng', dataIndex: 'row', width: 80, render: (value: number) => `#${value}` }, { title: 'Lý do không nhập', dataIndex: 'reason' }];

export function EyeExamImportModal({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<EyeExamImportPreview | null>(null); const [messageApi, holder] = message.useMessage();
  const [previewImport, previewState] = usePreviewEyeExamImportMutation(); const [importRows, importState] = useImportEyeExamsMutation();
  const reset = (): void => { setFile(null); setPreview(null); };
  const close = (): void => { if (!previewState.isLoading && !importState.isLoading) { reset(); onClose(); } };
  const readFile = async (selectedFile: File): Promise<void> => { if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) { messageApi.error('Chỉ hỗ trợ file Excel định dạng .xlsx.'); return; } if (selectedFile.size > 5 * 1024 * 1024) { messageApi.error('File Excel tối đa 5 MB.'); return; } setFile(selectedFile); setPreview(null); const body = new FormData(); body.append('file', selectedFile); try { setPreview(await previewImport(body).unwrap()); } catch (error: unknown) { setFile(null); messageApi.error(getErrorMessage(error)); } };
  const uploadProps: UploadProps = { accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxCount: 1, fileList: file ? [{ uid: file.name, name: file.name, status: 'done', size: file.size, type: file.type }] : [], beforeUpload: (selectedFile) => { void readFile(selectedFile); return false; }, onRemove: reset };
  const confirm = async (): Promise<void> => { if (!preview?.validRows.length) return; try { const result = await importRows({ rows: preview.validRows }).unwrap(); messageApi.success(`Đã tạo ${result.created} phiếu nháp từ Excel.${result.skipped ? ` Bỏ qua ${result.skipped} dòng.` : ''}`); close(); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  return <Modal className="customer-import-modal eye-exam-import-modal" title={<div className="customer-import-modal__title"><span><UploadOutlined /></span><div><strong>Nhập phiếu đo mắt từ Excel</strong><p>Kiểm tra trước khi tạo phiếu nháp mới.</p></div></div>} open={open} centered width={760} destroyOnHidden onCancel={close} footer={<Space size={10}><Button onClick={close}>Hủy</Button><Button type="primary" disabled={!preview?.validRows.length} loading={importState.isLoading} onClick={() => void confirm()}>Tạo {preview?.validRows.length ?? 0} phiếu nháp</Button></Space>}>
    {holder}
    <Alert className="eye-exam-import-modal__notice" type="info" showIcon message="Chỉ dành cho chuyển đổi dữ liệu" description="File nhập chỉ tạo phiếu nháp cho khách hàng đã có. Hệ thống không ghi đè, không tự chốt và không nhập phiếu cho khách chưa tồn tại." />
    <div className="customer-import-modal__intro"><div><strong>Nhập file mẫu</strong><span>Cột có dấu * là bắt buộc. Luôn xem các dòng lỗi trước khi xác nhận.</span></div><Button className="customer-import-modal__template-button" icon={<DownloadOutlined />} onClick={() => window.location.assign('/api/eye-exams/import-template')}>Tải file mẫu Excel</Button></div>
    <Upload.Dragger className="customer-import-modal__dropzone" {...uploadProps} disabled={previewState.isLoading || importState.isLoading}><p className="ant-upload-drag-icon"><InboxOutlined /></p><p className="ant-upload-text">Kéo thả file Excel vào đây hoặc chọn từ máy tính</p><p className="ant-upload-hint">Chỉ nhận .xlsx, tối đa 5 MB và 1.000 phiếu mỗi lần.</p></Upload.Dragger>
    {previewState.isLoading && <div className="customer-import-modal__checking">Đang kiểm tra dữ liệu trong file…</div>}
    {preview && <div className="customer-import-modal__result"><div className="customer-import-modal__stats"><div><span>Tổng dòng</span><strong>{preview.total}</strong></div><div className="customer-import-modal__stat--success"><span>Sẽ tạo nháp</span><strong>{preview.validRows.length}</strong></div><div className="customer-import-modal__stat--warning"><span>Không nhập</span><strong>{preview.issues.length}</strong></div></div>{preview.issues.length > 0 && <><Alert type="warning" showIcon message={`${preview.issues.length} dòng cần được bỏ qua`} description="Sửa file và tải lại nếu muốn bổ sung các dòng này." /><Table<EyeExamImportIssue> className="customer-import-modal__issues" rowKey={(item) => `${item.row}-${item.reason}`} columns={issueColumns} dataSource={preview.issues} pagination={preview.issues.length > 5 ? { pageSize: 5, size: 'small' } : false} size="small" /></>}{preview.total === 0 && <Alert type="info" showIcon message="File chưa có phiếu đo để nhập." />}</div>}
  </Modal>;
}
