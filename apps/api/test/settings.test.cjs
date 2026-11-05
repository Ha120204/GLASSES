const assert = require('node:assert/strict');
const test = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { vietQrBanks } = require('@glasses/shared');
const { UpdateSettingDto } = require('../dist/src/settings/dto/update-setting.dto.js');
const { SettingsService } = require('../dist/src/settings/settings.service.js');

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (body) => pipe.transform(body, { type: 'body', metatype: UpdateSettingDto });

test('settings DTO rejects blank names, malformed phones, invoice prefixes and unknown banks', async () => {
  for (const body of [
    { storeName: '   ' },
    { phone: 'abc' },
    { invoiceTemplate: 'bad prefix!' },
    { bankBin: '999999' },
  ]) {
    await assert.rejects(validate(body), (error) => error.status === 400);
  }
  const normalized = await validate({ storeName: '  Kính mắt  ', phone: '0901 234 567', invoiceTemplate: ' pm ' });
  assert.equal(normalized.storeName, 'Kính mắt');
  assert.equal(normalized.phone, '0901234567');
  assert.equal(normalized.invoiceTemplate, 'PM');
});

test('settings service validates the effective QR configuration after a partial update', async () => {
  let setting = {
    id: 'setting-1', storeName: 'Kính mắt', address: null, phone: null, invoiceTemplate: null,
    qrPaymentEnabled: false, bankName: null, bankBin: null, bankAccountNumber: null,
    bankAccountName: null, transferContentPrefix: 'DH',
  };
  const service = new SettingsService({
    setting: {
      findFirst: async () => setting,
      update: async ({ data }) => { setting = { ...setting, ...data }; return setting; },
    },
  });

  await assert.rejects(service.update({ qrPaymentEnabled: true }), (error) => error.status === 400);
  await assert.rejects(service.update({ bankBin: '999999' }), (error) => error.status === 400);
  const bank = vietQrBanks[0];
  await service.update({ bankBin: bank.bin, bankAccountNumber: '123456789', bankAccountName: 'nguyen van a' });
  const result = await service.update({ qrPaymentEnabled: true });
  assert.equal(result.bankName, bank.name);
  assert.equal(result.bankAccountName, 'NGUYEN VAN A');
  await assert.rejects(service.update({ bankAccountNumber: null }), (error) => error.status === 400);
});
