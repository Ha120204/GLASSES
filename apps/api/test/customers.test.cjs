const assert = require('node:assert/strict');
const test = require('node:test');
const { CustomersService } = require('../dist/src/customers/customers.service.js');
const { CustomerExcelService } = require('../dist/src/customers/customer-excel.service.js');
const { isCustomerBirthday, todayInVietnam } = require('../dist/src/customers/customer-birthday.util.js');
const XLSX = require('xlsx');

test('customer birthdays accept today and reject future or invalid calendar dates', () => {
  const today = todayInVietnam();
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.equal(isCustomerBirthday(today), true);
  assert.equal(isCustomerBirthday(tomorrow.toISOString().slice(0, 10)), false);
  assert.equal(isCustomerBirthday('2026-02-30'), false);
});

test('create and Excel import reject future birthdays before writing', async () => {
  const birthday = '2099-01-01';
  const customer = new CustomersService({ customer: { findFirst: async () => { throw new Error('Unexpected database write'); } } });
  await assert.rejects(customer.create({ name: 'QA Future', phone: '0901234567', birthday }), (error) => error.getStatus() === 400);
  const excel = new CustomerExcelService({});
  await assert.rejects(excel.importRows([{ row: 2, name: 'QA Future', phone: '0901234567', birthday }]), (error) => error.getStatus() === 400);
});

test('Excel preview identifies the original row and cell value needing correction', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Họ và tên', 'Số điện thoại', 'Ngày sinh'],
    ['Khách cũ', '0901234567', ''],
    [],
    ['Khách mới', '', ''],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Khách hàng');
  const preview = new CustomerExcelService({}).preview(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  assert.equal(preview.total, 2);
  assert.equal(preview.validRows.length, 1);
  assert.deepEqual(preview.issues, [{
    row: 4, reason: 'Thiếu số điện thoại.', name: 'Khách mới', phone: '', field: 'phone', value: '',
  }]);
});

test('Excel import updates an existing phone instead of skipping it', async () => {
  const updates = [];
  const prisma = {
    customer: {
      findMany: async () => [{ id: 'customer-1', phone: '0901234567', deletedAt: null }],
      update: async (args) => { updates.push(args); return {}; },
    },
    $transaction: (operations) => Promise.all(operations),
  };
  const result = await new CustomerExcelService(prisma).importRows([{ row: 2, name: 'Tên vừa sửa', phone: '0901234567' }]);
  assert.deepEqual(result, { created: 0, updated: 1, skipped: 0 });
  assert.equal(updates[0].where.id, 'customer-1');
  assert.equal(updates[0].data.name, 'Tên vừa sửa');
});

test('customer list combines search, gender, sorting and pagination', async () => {
  let findArgs;
  let countArgs;
  const service = new CustomersService({
    customer: {
      findMany: (args) => { findArgs = args; return Promise.resolve([]); },
      count: (args) => { countArgs = args; return Promise.resolve(0); },
    },
    $transaction: (operations) => Promise.all(operations),
  });
  await service.findAll({ q: ' QA ', gender: 'FEMALE', sortBy: 'name', sortDirection: 'asc', page: 2, pageSize: 20 });
  assert.equal(findArgs.where.gender, 'FEMALE');
  assert.equal(findArgs.where.OR[0].name.contains, 'QA');
  assert.deepEqual(findArgs.orderBy, [{ name: 'asc' }, { id: 'asc' }]);
  assert.equal(findArgs.skip, 20);
  assert.equal(findArgs.take, 20);
  assert.deepEqual(countArgs.where, findArgs.where);
});

