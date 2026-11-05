'use client';

import { DownloadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Table, Upload, message, type TableColumnsType, type UploadProps } from 'antd';
import { useState } from 'react';
import {
  getErrorMessage,
  type CustomerImportIssue,
  type CustomerImportPreview,
  useImportCustomersMutation,
  usePreviewCustomerImportMutation,
} from '@/store/api';
import { ExcelImportSelectedFile } from './excel-import-selected-file';

interface CustomerImportModalProps {
  open: boolean;
  onClose: () => void;
}

const issueColumns: TableColumnsType<CustomerImportIssue> = [
  { title: 'Dòng Excel', dataIndex: 'row', width: 95, render: (row: number) => `#${row}` },
  {
    title: 'Thông tin trong file',
    width: 190,
    render: (_, issue) => <div className="customer-import-modal__row-info">
      <strong>{issue.name || 'Chưa có họ tên'}</strong>
      <span>SĐT: {issue.phone || 'Để trống'}</span>
    </div>,
  },
  {
    title: 'Trường cần sửa',
    render: (_, issue) => {
      const fieldLabels: Record<CustomerImportIssue['field'], string> = {
        name: 'Họ tên', phone: 'Số điện thoại', birthday: 'Ngày sinh',
        gender: 'Giới tính', address: 'Địa chỉ', note: 'Ghi chú',
      };
      return <div className="customer-import-modal__issue-detail">
        <strong>{fieldLabels[issue.field]}: {issue.value || 'Để trống'}</strong>
        <span>{issue.reason}</span>
      </div>;
    },
  },
];

export function CustomerImportModal({ open, onClose }: CustomerImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewImport, previewState] = usePreviewCustomerImportMutation();
  const [importCustomers, importState] = useImportCustomersMutation();

  const reset = (): void => {
    setFile(null);
    setPreview(null);
  };
  const close = (): void => {
    if (previewState.isLoading || importState.isLoading) return;
    reset();
    onClose();
  };
  const readFile = async (selectedFile: File): Promise<void> => {
    if (!selectedFile.name.toLocaleLowerCase().endsWith('.xlsx')) {
      messageApi.error('Chỉ hỗ trợ file Excel định dạng .xlsx.');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      messageApi.error('File Excel tối đa 5 MB.');
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    const body = new FormData();
    body.append('file', selectedFile);
    try {
      setPreview(await previewImport(body).unwrap());
    } catch (error: unknown) {
      setFile(null);
      messageApi.error(getErrorMessage(error));
    }
  };
  const uploadProps: UploadProps = {
    accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    maxCount: 1,
    showUploadList: false,
    fileList: file ? [{ uid: file.name, name: file.name, status: 'done', size: file.size, type: file.type }] : [],
    beforeUpload: (selectedFile) => {
      void readFile(selectedFile);
      return false;
    },
    onRemove: () => reset(),
  };
  const confirmImport = async (): Promise<void> => {
    if (!preview?.validRows.length) return;
    try {
      const result = await importCustomers({ rows: preview.validRows }).unwrap();
      const updatedMessage = result.updated ? ` Đã cập nhật ${result.updated} hồ sơ.` : '';
      const skippedMessage = result.skipped ? ` ${result.skipped} dòng không thể xử lý đã được bỏ qua.` : '';
      messageApi.success(`Đã thêm ${result.created} khách hàng.${updatedMessage}${skippedMessage}`);
      close();
    } catch (error: unknown) {
      messageApi.error(getErrorMessage(error));
    }
  };
  const downloadTemplate = (): void => { window.location.assign('/api/customers/import-template'); };

  return (
    <Modal
      className="customer-import-modal"
      title={<div className="customer-import-modal__title"><span><UploadOutlined /></span><div><strong>Nhập khách hàng từ Excel</strong><p>Kiểm tra dữ liệu trước khi thêm hoặc cập nhật hồ sơ.</p></div></div>}
      open={open}
      centered
      width={760}
      destroyOnHidden
      onCancel={close}
      footer={
        <Space size={10}>
          <Button onClick={close}>Hủy</Button>
          <Button type="primary" disabled={!preview?.validRows.length} loading={importState.isLoading} onClick={() => void confirmImport()}>
            {preview?.total === 0 ? 'Chưa có dữ liệu để nhập' : `Xử lý ${preview?.validRows.length ?? 0} khách hàng`}
          </Button>
        </Space>
      }
    >
      {contextHolder}
      <div className="customer-import-modal__intro">
        <div><strong>Nhập file mẫu hoặc file đã xuất</strong><span>Cột có dấu * là bắt buộc. Hồ sơ có số điện thoại đã tồn tại sẽ được cập nhật.</span></div>
        <Button className="customer-import-modal__template-button" icon={<DownloadOutlined />} onClick={downloadTemplate}>
          Tải file mẫu Excel
        </Button>
      </div>
      <Upload.Dragger className="customer-import-modal__dropzone" {...uploadProps} disabled={previewState.isLoading || importState.isLoading}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{file ? 'Chọn file Excel khác để thay thế' : 'Kéo thả file Excel vào đây hoặc chọn từ máy tính'}</p>
        <p className="ant-upload-hint">Chỉ nhận .xlsx, dung lượng tối đa 5 MB và 1.000 khách hàng mỗi lần.</p>
      </Upload.Dragger>
      {file && <ExcelImportSelectedFile file={file} checking={previewState.isLoading} checked={Boolean(preview)} empty={preview?.total === 0} busy={previewState.isLoading || importState.isLoading} onRemove={reset} />}
      {previewState.isLoading && <div className="customer-import-modal__checking">Đang kiểm tra dữ liệu trong file…</div>}
      {preview && <div className="customer-import-modal__result">
        {preview.total === 0 ? <Alert className="customer-import-modal__empty" type="warning" showIcon message="Chưa có dữ liệu để nhập" description="File Excel chưa có dòng khách hàng nào. Hãy điền dữ liệu vào file mẫu, lưu lại rồi chọn file một lần nữa." /> : <>
        <div className="customer-import-modal__stats">
          <div><span>Tổng dòng</span><strong>{preview.total}</strong></div>
          <div className="customer-import-modal__stat--success"><span>Sẽ xử lý</span><strong>{preview.validRows.length}</strong></div>
          <div className="customer-import-modal__stat--warning"><span>Cần sửa</span><strong>{preview.issues.length}</strong></div>
        </div>
        {preview.validRows.length > 0 && <p className="customer-import-modal__update-note">Số điện thoại đã tồn tại sẽ được cập nhật theo dữ liệu trong file, kể cả các ô để trống. “Sẽ xử lý” gồm cả khách hàng mới và khách hàng được cập nhật.</p>}
        {preview.issues.length > 0 && <>
          <Alert type="warning" showIcon message={`${preview.issues.length} dòng chưa thể nhập`} description="Các dòng hợp lệ vẫn có thể được nhập. Hãy sửa những dòng bên dưới trong file rồi chọn lại để bổ sung." />
          <Table<CustomerImportIssue> className="customer-import-modal__issues" rowKey={(item) => `${item.row}-${item.reason}`} columns={issueColumns} dataSource={preview.issues} pagination={preview.issues.length > 5 ? { pageSize: 5, size: 'small' } : false} size="small" scroll={{ x: 610 }} />
        </>}
        </>}
      </div>}
    </Modal>
  );
}
