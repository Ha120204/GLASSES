'use client';

import { DownloadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Table, Tag, Upload, message, type TableColumnsType, type UploadProps } from 'antd';
import { useState } from 'react';
import { getErrorMessage, type EyeExamImportIssue, type EyeExamImportPreview, useImportEyeExamsMutation, usePreviewEyeExamImportMutation } from '@/store/api';
import { ExcelImportSelectedFile } from './excel-import-selected-file';

interface Props { open: boolean; onClose: () => void; }
const issueColumns: TableColumnsType<EyeExamImportIssue> = [
  { title: 'Dòng', dataIndex: 'row', width: 72, render: (value: number) => `#${value}` },
  { title: 'Trạng thái', key: 'status', width: 155, render: (_, issue) => <Tag color={issue.kind === 'existing' ? 'blue' : 'gold'}>{issue.kind === 'existing' ? 'Đã có · bỏ qua' : 'Cần kiểm tra'}</Tag> },
  { title: 'Chi tiết', dataIndex: 'reason' },
];

export function EyeExamImportModal({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<EyeExamImportPreview | null>(null); const [messageApi, holder] = message.useMessage();
  const [previewImport, previewState] = usePreviewEyeExamImportMutation(); const [importRows, importState] = useImportEyeExamsMutation();
  const existingCount = preview?.issues.filter((issue) => issue.kind === 'existing').length ?? 0;
  const onlyExisting = existingCount > 0 && existingCount === preview?.issues.length;
  const hasRowsWithoutCode = preview?.validRows.some((row) => !row.code) ?? false;
  const reset = (): void => { setFile(null); setPreview(null); };
  const close = (): void => { if (!previewState.isLoading && !importState.isLoading) { reset(); onClose(); } };
  const readFile = async (selectedFile: File): Promise<void> => { if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) { messageApi.error('Chỉ hỗ trợ file Excel định dạng .xlsx.'); return; } if (selectedFile.size > 5 * 1024 * 1024) { messageApi.error('File Excel tối đa 5 MB.'); return; } setFile(selectedFile); setPreview(null); const body = new FormData(); body.append('file', selectedFile); try { setPreview(await previewImport(body).unwrap()); } catch (error: unknown) { setFile(null); messageApi.error(getErrorMessage(error)); } };
  const uploadProps: UploadProps = { accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxCount: 1, showUploadList: false, fileList: file ? [{ uid: file.name, name: file.name, status: 'done', size: file.size, type: file.type }] : [], beforeUpload: (selectedFile) => { void readFile(selectedFile); return false; }, onRemove: reset };
  const confirm = async (): Promise<void> => { if (!preview?.validRows.length) return; try { const result = await importRows({ rows: preview.validRows }).unwrap(); if (result.created) messageApi.success(`Đã tạo ${result.created} phiếu nháp từ Excel.${result.skipped ? ` Bỏ qua ${result.skipped} phiếu đã có.` : ''}`); else messageApi.info('Các mã phiếu trong file đã tồn tại; không tạo bản nháp mới.'); close(); } catch (error: unknown) { messageApi.error(getErrorMessage(error)); } };
  return <Modal className="customer-import-modal eye-exam-import-modal" title={<div className="customer-import-modal__title"><span><UploadOutlined /></span><div><strong>Nhập phiếu đo mắt từ Excel</strong><p>Kiểm tra trước khi tạo phiếu nháp mới.</p></div></div>} open={open} centered width={760} destroyOnHidden onCancel={close} footer={<Space size={10}><Button onClick={close}>Hủy</Button><Button type="primary" disabled={!preview?.validRows.length} loading={importState.isLoading} onClick={() => void confirm()}>{preview?.total === 0 ? 'Chưa có dữ liệu để nhập' : preview?.validRows.length ? `Tạo ${preview.validRows.length} phiếu nháp` : 'Không có phiếu mới để tạo'}</Button></Space>}>
    {holder}
    <Alert className="eye-exam-import-modal__notice" type="info" showIcon message="Nhập phiếu đo từ Excel" description="File đã xuất được đối chiếu bằng Mã phiếu: phiếu đã có sẽ được bỏ qua. File mẫu không có mã sẽ tạo phiếu nháp mới cho từng dòng hợp lệ. Hệ thống không ghi đè hoặc tự chốt phiếu." />
    <div className="customer-import-modal__intro"><div><strong>Nhập file mẫu hoặc file đã xuất</strong><span>Cột có dấu * là bắt buộc. Xem kết quả đối chiếu trước khi xác nhận.</span></div><Button className="customer-import-modal__template-button" icon={<DownloadOutlined />} onClick={() => window.location.assign('/api/eye-exams/import-template')}>Tải file mẫu Excel</Button></div>
    <Upload.Dragger className="customer-import-modal__dropzone" {...uploadProps} disabled={previewState.isLoading || importState.isLoading}><p className="ant-upload-drag-icon"><InboxOutlined /></p><p className="ant-upload-text">{file ? 'Chọn file Excel khác để thay thế' : 'Kéo thả file Excel vào đây hoặc chọn từ máy tính'}</p><p className="ant-upload-hint">Chỉ nhận .xlsx, tối đa 5 MB và 1.000 phiếu mỗi lần.</p></Upload.Dragger>
    {file && <ExcelImportSelectedFile file={file} checking={previewState.isLoading} checked={Boolean(preview)} empty={preview?.total === 0} busy={previewState.isLoading || importState.isLoading} onRemove={reset} />}
    {previewState.isLoading && <div className="customer-import-modal__checking">Đang kiểm tra dữ liệu trong file…</div>}
    {preview && <div className="customer-import-modal__result">
      {preview.total === 0 ? <Alert className="customer-import-modal__empty" type="warning" showIcon message="Chưa có dữ liệu để nhập" description="File Excel chưa có dòng phiếu đo nào. Hãy điền dữ liệu vào file mẫu, lưu lại rồi chọn file một lần nữa." /> : <>
      <div className="customer-import-modal__stats">
        <div><span>Tổng dòng</span><strong>{preview.total}</strong></div>
        <div className="customer-import-modal__stat--success"><span>Sẽ tạo nháp</span><strong>{preview.validRows.length}</strong></div>
        <div className={onlyExisting ? 'eye-exam-import-modal__stat--existing' : 'customer-import-modal__stat--warning'}><span>{onlyExisting ? 'Đã có · bỏ qua' : existingCount === 0 ? 'Cần kiểm tra' : 'Bỏ qua / cần kiểm tra'}</span><strong>{preview.issues.length}</strong></div>
      </div>
      {existingCount > 0 && <Alert className="eye-exam-import-modal__guidance" type="info" showIcon message={`${existingCount} phiếu đã có trong hệ thống`} description="Mã phiếu trong file đã trùng với phiếu hiện có. Hệ thống giữ nguyên các phiếu này và không tạo bản nháp mới." />}
      {hasRowsWithoutCode && <Alert className="eye-exam-import-modal__guidance" type="info" showIcon message="Có dòng không có mã phiếu" description="Mỗi dòng hợp lệ sẽ tạo một phiếu nháp mới. Cùng khách hàng và ngày đo vẫn có thể là hai lần đo riêng; hãy kiểm tra file trước khi xác nhận." />}
      {preview.issues.length > existingCount && <Alert className="eye-exam-import-modal__guidance" type="warning" showIcon message={`${preview.issues.length - existingCount} dòng cần kiểm tra`} description="Xem lý do theo từng dòng bên dưới và sửa file nếu cần." />}
      {preview.issues.length > 0 && <Table<EyeExamImportIssue> className={`customer-import-modal__issues eye-exam-import-modal__issues${onlyExisting ? ' eye-exam-import-modal__issues--existing-only' : ''}`} rowKey={(item) => `${item.row}-${item.reason}`} columns={issueColumns} dataSource={preview.issues} pagination={preview.issues.length > 5 ? { pageSize: 5, size: 'small' } : false} size="small" scroll={{ x: 610 }} />}
      </>}
    </div>}
  </Modal>;
}
