import { BadRequestException, Injectable } from '@nestjs/common';
import { vietQrBanks } from '@glasses/shared';
import { Prisma, type Setting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const defaultSetting = { storeName: 'Cửa hàng kính mắt' };

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Setting> {
    const setting = await this.prisma.setting.findFirst();
    return setting ?? this.prisma.setting.create({ data: defaultSetting });
  }

  async update(dto: UpdateSettingDto): Promise<Setting> {
    const setting = await this.get();
    const qrPaymentEnabled = dto.qrPaymentEnabled ?? setting.qrPaymentEnabled;
    const bankBin = dto.bankBin !== undefined ? dto.bankBin?.trim() || null : setting.bankBin;
    const bank = vietQrBanks.find((item) => item.bin === bankBin);
    const bankAccountNumber = dto.bankAccountNumber !== undefined
      ? dto.bankAccountNumber?.replace(/\s/g, '') || null
      : setting.bankAccountNumber;
    const bankAccountName = dto.bankAccountName !== undefined
      ? dto.bankAccountName?.trim().toUpperCase() || null
      : setting.bankAccountName;

    if (bankBin && !bank && (qrPaymentEnabled || dto.bankBin !== undefined)) {
      throw new BadRequestException('Chọn ngân hàng có trong danh sách VietQR.');
    }
    if (qrPaymentEnabled) {
      if (!bank) throw new BadRequestException('Chọn ngân hàng nhận tiền trước khi bật thanh toán QR.');
      if (!/^\d{6,30}$/.test(bankAccountNumber ?? '')) {
        throw new BadRequestException('Nhập số tài khoản từ 6 đến 30 chữ số trước khi bật thanh toán QR.');
      }
      if (!bankAccountName) throw new BadRequestException('Nhập tên chủ tài khoản trước khi bật thanh toán QR.');
    }

    const data: Prisma.SettingUncheckedUpdateInput = {
      ...(dto.storeName !== undefined ? { storeName: dto.storeName.trim() } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.invoiceTemplate !== undefined ? { invoiceTemplate: dto.invoiceTemplate?.trim() || null } : {}),
      ...(dto.qrPaymentEnabled !== undefined ? { qrPaymentEnabled: dto.qrPaymentEnabled } : {}),
      ...(qrPaymentEnabled || dto.bankBin !== undefined || dto.bankName !== undefined ? { bankName: bank?.name ?? null } : {}),
      ...(dto.bankBin !== undefined ? { bankBin: dto.bankBin?.trim() || null } : {}),
      ...(dto.bankAccountNumber !== undefined ? { bankAccountNumber } : {}),
      ...(dto.bankAccountName !== undefined ? { bankAccountName } : {}),
      ...(dto.transferContentPrefix !== undefined ? { transferContentPrefix: dto.transferContentPrefix.trim().toUpperCase() || 'DH' } : {}),
    };
    return this.prisma.setting.update({ where: { id: setting.id }, data });
  }
}
