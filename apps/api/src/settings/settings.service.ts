import { Injectable } from '@nestjs/common';
import { Prisma, type Setting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

const defaultSetting = { storeName: 'Cửa hàng kính mắt', reminderMonths: 12 };

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<Setting> {
    const setting = await this.prisma.setting.findFirst();
    return setting ?? this.prisma.setting.create({ data: defaultSetting });
  }

  async update(dto: UpdateSettingDto): Promise<Setting> {
    const setting = await this.get();
    const data: Prisma.SettingUncheckedUpdateInput = {
      ...(dto.storeName !== undefined ? { storeName: dto.storeName.trim() || defaultSetting.storeName } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.invoiceTemplate !== undefined ? { invoiceTemplate: dto.invoiceTemplate?.trim() || null } : {}),
      ...(dto.reminderMonths !== undefined ? { reminderMonths: dto.reminderMonths } : {}),
    };
    return this.prisma.setting.update({ where: { id: setting.id }, data });
  }
}
