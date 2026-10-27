'use client';

import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Spin } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { formatAxis, formatDiopter } from '@glasses/shared';
import { type PrismBase, useEyeExamQuery } from '@/store/api';

const formatPrism = (prism: number | null, base: PrismBase | null): string => prism === null ? '—' : `${prism.toFixed(2)}Δ${base ? ` ${base}` : ''}`;
const wearingPurposeLabels: Record<string, string> = { DISTANCE: 'Nhìn xa', NEAR: 'Đọc gần', INTERMEDIATE: 'Máy tính / trung gian', MULTIPURPOSE: 'Đa mục đích' };
const lensDesignLabels: Record<string, string> = { SINGLE_VISION: 'Tròng đơn', BIFOCAL: 'Hai tròng', PROGRESSIVE: 'Đa tròng' };
const formatExamCode = (prefix: string | null | undefined, id: string): string => `${prefix ? `${prefix.trim().toUpperCase()}-` : ''}${id.slice(-6).toUpperCase()}`;

export default function PrintEyeExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useEyeExamQuery(id);
  if (isLoading || !data) return <Spin />;
  const rxRow = (name: string, sph: number | null, cyl: number | null, axis: number | null, add: number | null, pd: number | null) => <tr><th>{name}</th><td>{formatDiopter(sph)}</td><td>{formatDiopter(cyl)}</td><td>{formatAxis(axis)}</td><td>{formatDiopter(add)}</td><td>{pd ?? '—'}</td></tr>;
  const advancedRow = (name: string, prism: number | null, base: PrismBase | null, segHeight: number | null) => <tr><th>{name}</th><td>{formatPrism(prism, base)}</td><td>{segHeight === null ? '—' : `${segHeight.toFixed(1)} mm`}</td></tr>;
  const hasAdvancedMeasurements = data.rPrism !== null || data.lPrism !== null || data.rSegHeight !== null || data.lSegHeight !== null;

  return <div className="print-sheet"><div className="no-print"><Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>Quay lại</Button><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()} style={{ marginLeft: 8 }}>In phiếu</Button></div><Card className="surface-card"><h1>{data.setting?.storeName ?? 'Cửa hàng kính mắt'}</h1><p>{data.setting?.address} · {data.setting?.phone}</p><h2>PHIẾU ĐO MẮT</h2><p><b>Mã phiếu:</b> {formatExamCode(data.setting?.invoiceTemplate, data.id)}</p><Descriptions size="small" column={2} items={[{ key: 'name', label: 'Khách hàng', children: data.customer?.name }, { key: 'phone', label: 'Số điện thoại', children: data.customer?.phone }, { key: 'date', label: 'Ngày đo', children: new Intl.DateTimeFormat('vi-VN').format(new Date(data.examDate)) }, { key: 'kind', label: 'Loại phiếu', children: data.noPrescription ? 'Không kê đơn kính' : 'Có kê đơn kính' }]} />{data.wearingPurpose || data.lensDesign ? <p><b>Thông tin lắp kính:</b> {[data.wearingPurpose ? `Nhu cầu: ${wearingPurposeLabels[data.wearingPurpose] ?? data.wearingPurpose}` : null, data.lensDesign ? `Thiết kế tròng: ${lensDesignLabels[data.lensDesign] ?? data.lensDesign}` : null].filter(Boolean).join(' · ')}</p> : null}{data.noPrescription ? <p><b>Không kê đơn kính:</b> {data.noPrescriptionReason || 'Chưa ghi lý do.'}</p> : <><table className="rx-print"><thead><tr><th>Mắt</th><th>SPH</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>PD đơn mắt</th></tr></thead><tbody>{rxRow('OD (Phải)', data.rSph, data.rCyl, data.rAxis, data.rAdd, data.rPd)}{rxRow('OS (Trái)', data.lSph, data.lCyl, data.lAxis, data.lAdd, data.lPd)}</tbody></table>{data.pdTotal !== null ? <p><b>PD tổng:</b> {data.pdTotal} mm</p> : null}</>}{hasAdvancedMeasurements ? <><h3>THÔNG SỐ LẮP TRÒNG</h3><table className="rx-print rx-print--advanced"><thead><tr><th>Mắt</th><th>Prism / Base</th><th>Cao lắp tròng</th></tr></thead><tbody>{advancedRow('OD (Phải)', data.rPrism, data.rBase, data.rSegHeight)}{advancedRow('OS (Trái)', data.lPrism, data.lBase, data.lSegHeight)}</tbody></table></> : null}<p><b>Ghi chú:</b> {data.note || '—'}</p></Card></div>;
}
