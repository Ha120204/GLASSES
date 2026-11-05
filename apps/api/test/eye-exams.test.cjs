const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { Prisma } = require('@prisma/client');
const ExcelJS = require('exceljs');
const { EyeExamsService } = require('../dist/src/eye-exams/eye-exams.service.js');
const { EyeExamExcelService } = require('../dist/src/eye-exams/eye-exam-excel.service.js');

test('retrying a create request returns the original exam and rejects changed content', async () => {
  const dto = {
    idempotencyKey: '9b0e1c9d-dd4d-4c4e-a3aa-6bd6c6393b37',
    customerId: 'customer-1',
    examDate: '2026-11-01',
  };
  const requestHash = createHash('sha256').update(JSON.stringify({
    locked: false,
    customerId: dto.customerId,
    examDate: new Date(dto.examDate),
  })).digest('hex');
  const original = { id: 'exam-1', requestHash, idempotencyKey: dto.idempotencyKey };
  const service = new EyeExamsService({
    eyeExam: { findUnique: async () => original },
    $transaction: async () => { throw new Error('Retry attempted a second write'); },
  });

  assert.equal((await service.create(dto, 'admin-1')).id, original.id);
  assert.equal((await service.create(dto, 'admin-1')).id, original.id);
  await assert.rejects(service.create({ ...dto, note: 'changed' }, 'admin-1'), (error) => error.getStatus() === 409);
  await assert.rejects(service.createAndLock(dto, 'admin-1'), (error) => error.getStatus() === 409);
});

test('Excel import still creates a single valid row', async () => {
  let writes = 0;
  const service = new EyeExamExcelService({
    $transaction: async (run) => run({
      customer: { findMany: async () => [{ id: 'customer-1', phone: '0901234567' }] },
      eyeExam: { create: async () => { writes += 1; return { id: 'exam-1' }; } },
      eyeExamAuditLog: { create: async () => { writes += 1; } },
    }),
  });
  const result = await service.importRows([{ row: 2, phone: '0901234567', examDate: '2026-11-01', noPrescription: false }], 'admin-1');
  assert.deepEqual(result, { created: 1, skipped: 0 });
  assert.equal(writes, 2);
});

test('two exams for the same customer and date remain separate without codes', async () => {
  let created = 0;
  const service = new EyeExamExcelService({
    $transaction: async (run) => run({
      customer: { findMany: async () => [{ id: 'customer-1', phone: '0901234567' }] },
      eyeExam: { create: async () => ({ id: `exam-${++created}` }) },
      eyeExamAuditLog: { create: async () => {} },
    }),
  });
  const row = { row: 2, phone: '0901234567', examDate: '2026-11-01', noPrescription: false };
  assert.deepEqual(await service.importRows([row, { ...row, row: 3 }], 'admin-1'), { created: 2, skipped: 0 });
  assert.equal(created, 2);
});

test('template keeps entered day and month as text', async () => {
  const service = new EyeExamExcelService({ customer: { findMany: async () => [{ phone: '0901234567' }] } });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await service.createTemplate());
  const sheet = workbook.getWorksheet('Phiếu đo mắt');
  assert.equal(sheet.getCell('B2').numFmt, '@');
  sheet.getCell('A2').value = '0901234567';
  sheet.getCell('B2').value = '04/11/2026';
  sheet.getCell('A3').value = '0901234567';
  sheet.getCell('B3').value = '04/11/2026';
  const preview = await service.preview(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.deepEqual(preview.issues, []);
  assert.equal(preview.validRows[0].examDate, '2026-11-04');
  assert.equal(preview.validRows.length, 2);
});

test('reimporting an exported file skips all existing codes, even for the same customer and date', async () => {
  const exam = {
    id: 'exam-1', code: 'PM-000001', customer: { phone: '0901234567' },
    examDate: new Date('2026-10-31T00:00:00.000Z'),
    rSph: new Prisma.Decimal('10'), rCyl: new Prisma.Decimal('0.25'), rAxis: 10,
    rAdd: null, rPd: null, rPrism: null, rBase: null, rSegHeight: null,
    lSph: new Prisma.Decimal('20'), lCyl: null, lAxis: null, lAdd: null,
    lPd: null, lPrism: null, lBase: null, lSegHeight: null,
    pdTotal: null, wearingPurpose: 'MULTIPURPOSE', lensDesign: 'SINGLE_VISION',
    noPrescription: false, noPrescriptionReason: null, note: null, lockedAt: new Date(),
  };
  const exams = Array.from({ length: 5 }, (_, index) => ({
    ...exam,
    id: `exam-${index + 1}`,
    code: `PM-${String(index + 1).padStart(6, '0')}`,
  }));
  const service = new EyeExamExcelService({
    eyeExam: { findMany: async (args) => args.select?.code ? exams.map(({ code }) => ({ code })) : exams },
  });
  const exported = await service.export({});
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported);
  const sheet = workbook.getWorksheet('Phiếu đo mắt');
  assert.equal(sheet.getCell('A2').value, 'PM-000001');
  assert.equal(sheet.getCell('C2').value, '31/10/2026');
  assert.equal(sheet.getCell('D2').value, 10);
  assert.equal(sheet.getCell('E2').value, 0.25);
  assert.equal(sheet.getCell('L2').value, 20);

  const preview = await service.preview(exported);
  assert.equal(preview.total, 5);
  assert.equal(preview.validRows.length, 0);
  assert.equal(preview.issues.length, 5);
  assert.ok(preview.issues.every((issue) => issue.kind === 'existing'));
});

test('preview accepts distinct coded exams on the same day and rejects repeated codes', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Phiếu đo mắt');
  sheet.addRow(['Mã phiếu', 'Số điện thoại khách hàng*', 'Ngày đo*']);
  sheet.addRow(['PM-000101', '0901234567', '31/10/2026']);
  sheet.addRow(['PM-000102', '0901234567', '31/10/2026']);
  sheet.addRow(['PM-000101', '0901234567', '31/10/2026']);
  const service = new EyeExamExcelService({
    eyeExam: { findMany: async () => [] },
    customer: { findMany: async () => [{ phone: '0901234567' }] },
  });
  const preview = await service.preview(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.deepEqual(preview.validRows.map((row) => row.code), ['PM-000101', 'PM-000102']);
  assert.equal(preview.issues.length, 1);
  assert.match(preview.issues[0].reason, /bị lặp trong file/);
});

test('older exports with only an internal ID require a fresh export before reimport', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Phiếu đo mắt');
  sheet.addRow(['ID phiếu', 'Số điện thoại khách hàng*', 'Ngày đo*']);
  sheet.addRow(['cmoldexam0001', '0901234567', '31/10/2026']);
  const service = new EyeExamExcelService({});
  await assert.rejects(
    service.preview(Buffer.from(await workbook.xlsx.writeBuffer())),
    (error) => error.getStatus() === 400 && error.message.includes('Mã phiếu'),
  );
});

test('import rechecks codes at confirmation and creates only new rows', async () => {
  const createdCodes = [];
  const service = new EyeExamExcelService({
    $transaction: async (run) => run({
      eyeExam: {
        findMany: async () => [{ code: 'PM-000001' }],
        create: async ({ data }) => { createdCodes.push(data.code); return { id: 'new-exam' }; },
      },
      customer: { findMany: async () => [{ id: 'customer-1', phone: '0901234567' }] },
      eyeExamAuditLog: { create: async () => {} },
    }),
  });
  const rows = [
    { row: 2, code: 'PM-000001', phone: '0901234567', examDate: '2026-10-31', noPrescription: false },
    { row: 3, code: 'PM-000002', phone: '0901234567', examDate: '2026-10-31', noPrescription: false },
  ];
  assert.deepEqual(await service.importRows(rows, 'admin-1'), { created: 1, skipped: 1 });
  assert.deepEqual(createdCodes, ['PM-000002']);
});

