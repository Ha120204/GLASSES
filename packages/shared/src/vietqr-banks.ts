export interface VietQrBank {
  bin: string;
  shortName: string;
  name: string;
}

// Danh sách cục bộ để phần mềm Windows vẫn tìm/chọn ngân hàng khi không có Internet.
export const vietQrBanks: VietQrBank[] = [
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970405', shortName: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970422', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân đội' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh' },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
  { bin: '970448', shortName: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
  { bin: '970425', shortName: 'ABBank', name: 'Ngân hàng TMCP An Bình' },
  { bin: '970452', shortName: 'KienlongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { bin: '970428', shortName: 'Nam A Bank', name: 'Ngân hàng TMCP Nam Á' },
  { bin: '970427', shortName: 'VietABank', name: 'Ngân hàng TMCP Việt Á' },
  { bin: '970433', shortName: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
  { bin: '970430', shortName: 'PGBank', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển' },
  { bin: '970419', shortName: 'NCB', name: 'Ngân hàng TMCP Quốc Dân' },
  { bin: '970409', shortName: 'Bac A Bank', name: 'Ngân hàng TMCP Bắc Á' },
  { bin: '970412', shortName: 'PVcomBank', name: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
  { bin: '970429', shortName: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
  { bin: '970406', shortName: 'DongA Bank', name: 'Ngân hàng TMCP Đông Á' },
  { bin: '970438', shortName: 'BaoViet Bank', name: 'Ngân hàng TMCP Bảo Việt' },
  { bin: '970439', shortName: 'Public Bank', name: 'Ngân hàng TNHH MTV Public Việt Nam' },
  { bin: '970446', shortName: 'Co-opBank', name: 'Ngân hàng Hợp tác xã Việt Nam' },
  { bin: '970457', shortName: 'Woori Bank', name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
  { bin: '970458', shortName: 'UOB', name: 'Ngân hàng TNHH MTV UOB Việt Nam' },
];
