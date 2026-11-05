'use client';

import { DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import { Button } from 'antd';

interface Props {
  file: File;
  checking: boolean;
  checked: boolean;
  empty: boolean;
  busy: boolean;
  onRemove: () => void;
}

export function ExcelImportSelectedFile({ file, checking, checked, empty, busy, onRemove }: Props) {
  return <div className={`excel-import-selected-file${empty ? ' excel-import-selected-file--empty' : ''}`} role="status">
    <span className="excel-import-selected-file__icon"><FileExcelOutlined /></span>
    <div className="excel-import-selected-file__info">
      <span>FILE EXCEL ĐÃ CHỌN</span>
      <strong title={file.name}>{file.name}</strong>
      <small>{checking ? 'Đang kiểm tra dữ liệu…' : empty ? 'Chưa có dữ liệu để nhập' : checked ? 'Đã kiểm tra dữ liệu' : 'Sẵn sàng kiểm tra'}</small>
    </div>
    <Button type="text" danger icon={<DeleteOutlined />} disabled={busy} onClick={onRemove}>Bỏ file</Button>
  </div>;
}
