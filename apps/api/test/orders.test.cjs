const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const ExcelJS = require('exceljs');
const { OrdersService } = require('../dist/src/orders/orders.service.js');
const { OrderExcelService } = require('../dist/src/orders/order-excel.service.js');
const { CancelOrderDto } = require('../dist/src/orders/dto/cancel-order.dto.js');

const normalize = (value) => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]))
    : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');

test('refund account holder must contain letters and no digits', () => {
  const input = { reason: 'Khách đổi ý', refundMethod: 'TRANSFER', refundBankName: 'Ngân hàng A', refundAccountNumber: '123456', refundAccountName: '' };
  for (const name of ['13132213212132', 'Nguyễn Văn A1']) {
    const errors = validateSync(plainToInstance(CancelOrderDto, { ...input, refundAccountName: name }));
    assert.ok(errors.some((error) => error.property === 'refundAccountName'));
  }
  const valid = validateSync(plainToInstance(CancelOrderDto, { ...input, refundAccountName: 'Nguyễn Văn A' }));
  assert.equal(valid.length, 0);
});

test('an already delivered order cannot be cancelled or refunded', async () => {
  let written = false;
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => ({ status: 'DELIVERED' }),
        update: async () => { written = true; },
      },
      payment: { create: async () => { written = true; } },
    }),
  });
  await assert.rejects(service.cancel('order-1', { reason: 'Khách đổi ý' }, 'admin-1'), (error) => error.getStatus() === 409);
  assert.equal(written, false);
});

test('only settled, completed orders can be archived', async () => {
  const order = { status: 'IN_PROGRESS', outstandingAmount: 0, archivedAt: null };
  let writes = 0;
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        update: async () => { writes += 1; },
      },
      orderAuditLog: { create: async () => { writes += 1; } },
    }),
  });
  await assert.rejects(service.archive('order-1', 'admin-1'), (error) => error.getStatus() === 409);
  order.status = 'DELIVERED';
  order.outstandingAmount = 1;
  await assert.rejects(service.archive('order-1', 'admin-1'), (error) => error.getStatus() === 409);
  order.outstandingAmount = 0;
  order.archivedAt = new Date();
  await assert.rejects(service.archive('order-1', 'admin-1'), (error) => error.getStatus() === 409);
  assert.equal(writes, 0);
});

test('archiving and restoring preserve order status and record both actors', async () => {
  const order = { status: 'CANCELLED', outstandingAmount: 0, archivedAt: null, archivedById: null };
  const updates = [];
  const auditLogs = [];
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        update: async ({ data }) => {
          updates.push(data);
          Object.assign(order, data);
          return { ...order };
        },
      },
      orderAuditLog: { create: async ({ data }) => { auditLogs.push(data); } },
    }),
  });
  const archived = await service.archive('order-1', 'admin-1');
  assert.ok(archived.archivedAt instanceof Date);
  assert.equal(archived.archivedById, 'admin-1');
  assert.equal(archived.status, 'CANCELLED');
  await assert.rejects(service.archive('order-1', 'admin-1'), (error) => error.getStatus() === 409);
  const restored = await service.restore('order-1', 'admin-2');
  assert.equal(restored.archivedAt, null);
  assert.equal(restored.archivedById, null);
  assert.equal(restored.status, 'CANCELLED');
  await assert.rejects(service.restore('order-1', 'admin-2'), (error) => error.getStatus() === 409);
  assert.equal(updates.length, 2);
  assert.deepEqual(auditLogs.map(({ action, createdById }) => [action, createdById]), [['ARCHIVED', 'admin-1'], ['RESTORED', 'admin-2']]);
});

test('cancelling a paid order keeps the refund pending until money is returned', async () => {
  const order = { status: 'IN_PROGRESS', deposit: 50000, payments: [], archivedAt: null };
  const payments = [];
  let updates = 0;
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        update: async ({ data }) => { updates += 1; Object.assign(order, data); return { ...order }; },
      },
      payment: { create: async ({ data }) => { payments.push(data); } },
    }),
  });
  for (const refundAccountName of ['13132213212132', 'Nguyễn Văn A1']) {
    await assert.rejects(service.cancel('order-1', { reason: 'Khách đổi ý', refundMethod: 'TRANSFER', refundBankName: 'Ngân hàng A', refundAccountNumber: '123456', refundAccountName }, 'admin-1'), (error) => error.getStatus() === 400);
  }
  assert.equal(updates, 0);
  const cancelled = await service.cancel('order-1', { reason: 'Khách đổi ý', refundMethod: 'TRANSFER', refundBankName: 'Ngân hàng A', refundAccountNumber: '123456', refundAccountName: 'Nguyễn Văn A' }, 'admin-1');
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.refundPendingAmount, 50000);
  assert.equal(cancelled.refundAccountNumber, '123456');
  assert.equal(payments.length, 0);
  await assert.rejects(service.archive('order-1', 'admin-1'), (error) => error.getStatus() === 409);
});

test('confirming a manual transfer records one refund after explicit confirmation', async () => {
  const order = { status: 'CANCELLED', refundPendingAmount: 50000, refundMethod: 'TRANSFER', archivedAt: null };
  const payments = [];
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        update: async ({ data }) => { Object.assign(order, data); return { ...order }; },
      },
      payment: { create: async ({ data }) => { payments.push(data); } },
    }),
  });
  await assert.rejects(service.confirmRefund('order-1', { confirmed: false, reference: 'TX-1' }, 'admin-1'), (error) => error.getStatus() === 400);
  await assert.rejects(service.confirmRefund('order-1', { confirmed: true }, 'admin-1'), (error) => error.getStatus() === 400);
  const refunded = await service.confirmRefund('order-1', { confirmed: true, reference: 'TX-1' }, 'admin-1');
  assert.equal(refunded.refundPendingAmount, 0);
  assert.deepEqual(payments.map(({ amount, method, type, reference }) => ({ amount, method, type, reference })), [{ amount: 50000, method: 'TRANSFER', type: 'REFUND', reference: 'TX-1' }]);
  await assert.rejects(service.confirmRefund('order-1', { confirmed: true, reference: 'TX-1' }, 'admin-1'), (error) => error.getStatus() === 409);
});

test('only archived cancelled orders can be permanently deleted', async () => {
  const order = { status: 'DELIVERED', archivedAt: new Date(), refundPendingAmount: 0 };
  const deleted = [];
  const service = new OrdersService({
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        delete: async ({ where }) => { deleted.push(where.id); },
      },
    }),
  });
  await assert.rejects(service.permanentlyDelete('order-1'), (error) => error.getStatus() === 409);
  order.status = 'CANCELLED';
  order.archivedAt = null;
  await assert.rejects(service.permanentlyDelete('order-1'), (error) => error.getStatus() === 409);
  order.archivedAt = new Date();
  order.refundPendingAmount = 100;
  await assert.rejects(service.permanentlyDelete('order-1'), (error) => error.getStatus() === 409);
  order.refundPendingAmount = 0;
  await service.permanentlyDelete('order-1');
  assert.deepEqual(deleted, ['order-1']);
});

test('order list and Excel use the same active and archived scopes', async () => {
  const listWhere = [];
  const service = new OrdersService({
    order: {
      findMany: async ({ where }) => { listWhere.push(where); return []; },
      count: async () => 0,
    },
    $transaction: async (operations) => Promise.all(operations),
  });
  const excel = new OrderExcelService({});
  const query = { page: 1, pageSize: 10, sortDirection: 'desc' };
  await service.findAll(query);
  await service.findAll({ ...query, archiveView: 'ARCHIVED' });
  const visibleScope = { AND: [{ archivedAt: null }, { OR: [{ status: { not: 'CANCELLED' } }, { refundPendingAmount: { gt: 0 } }] }] };
  assert.deepEqual(listWhere, [visibleScope, { archivedAt: { not: null } }]);
  const activeExport = await excel.createWhere(query);
  const archivedExport = await excel.createWhere({ ...query, archiveView: 'ARCHIVED' });
  assert.deepEqual(activeExport, visibleScope);
  assert.deepEqual(archivedExport, { archivedAt: { not: null } });
  await service.findAll({ ...query, q: 'khách' });
  assert.equal(listWhere[2].AND[0].OR.length, 4);
  assert.deepEqual(listWhere[2].AND[1], visibleScope.AND[1]);
});

test('repeated create request returns the original order without writing again', async () => {
  const dto = { idempotencyKey: 'a51af0dd-a448-4afd-99b0-1fab6fc27982', customerId: 'customer-1', items: [{ productId: 'product-1', qty: 1 }] };
  const original = { id: 'order-1', requestHash: hash(dto) };
  const service = new OrdersService({
    order: { findUnique: async () => original },
    $transaction: async () => { throw new Error('Duplicate request attempted a second write'); },
  });
  assert.equal(await service.create(dto, 'admin-1'), original);
  assert.equal(await service.create({ items: dto.items, customerId: dto.customerId, idempotencyKey: dto.idempotencyKey }, 'admin-1'), original);
});

test('payment retry returns its first payment and rejects changed content', async () => {
  const dto = { idempotencyKey: '145483bf-79c8-410b-a5ce-513c860dc063', amount: 100000, method: 'CASH' };
  const original = { id: 'payment-1', requestHash: hash({ id: 'order-1', ...dto }) };
  const service = new OrdersService({
    payment: { findUnique: async () => original },
    $transaction: async () => { throw new Error('Retry attempted a second payment'); },
  });
  assert.equal(await service.createPayment('order-1', dto, 'admin-1'), original);
  await assert.rejects(service.createPayment('order-1', { ...dto, amount: 200000 }, 'admin-1'), (error) => error.getStatus() === 409);
});

test('an order awaiting QR accepts only a full transfer payment', async () => {
  const order = { status: 'AWAITING_PAYMENT', total: 20000, deposit: 0, payments: [] };
  const payments = [];
  const service = new OrdersService({
    payment: { findUnique: async () => null },
    $transaction: async (run) => run({
      $queryRaw: async () => [],
      order: {
        findUnique: async () => order,
        update: async ({ data }) => { Object.assign(order, data); return order; },
      },
      payment: {
        findUnique: async () => null,
        create: async ({ data }) => { payments.push(data); return data; },
      },
    }),
  });
  const base = { idempotencyKey: '145483bf-79c8-410b-a5ce-513c860dc063', amount: 20000, method: 'TRANSFER' };
  await assert.rejects(service.createPayment('order-1', { ...base, method: 'CASH' }, 'admin-1'), (error) => error.getStatus() === 400);
  await assert.rejects(service.createPayment('order-1', { ...base, amount: 10000 }, 'admin-1'), (error) => error.getStatus() === 400);
  assert.equal(payments.length, 0);
  await service.createPayment('order-1', base, 'admin-1');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].method, 'TRANSFER');
  assert.equal(order.status, 'DELIVERED');
  assert.equal(order.outstandingAmount, 0);
});

test('Excel export reads large results in bounded batches', async () => {
  const orders = Array.from({ length: 501 }, (_, index) => ({
    id: `order-${index}`,
    code: `DH-${index}`,
    createdAt: new Date('2026-10-31T00:00:00Z'),
    customer: { name: 'Khách hàng', phone: '0900000000' },
    items: [{ name: 'Gọng kính', qty: 1 }],
    payments: [],
    deposit: 0,
    total: 100000,
    status: 'IN_PROGRESS',
    dueDate: null,
    warrantyUntil: null,
    note: null,
    refundPendingAmount: index === 0 ? 50000 : 0,
  }));
  const batchSizes = [];
  const service = new OrderExcelService({
    order: { findMany: async ({ cursor, take }) => {
      batchSizes.push(take);
      const offset = cursor ? orders.findIndex((order) => order.id === cursor.id) + 1 : 0;
      return orders.slice(offset, offset + take);
    } },
  });
  const stream = await service.export({ sortDirection: 'desc' });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks));
  const sheet = workbook.getWorksheet('Đơn hàng');
  assert.equal(sheet.rowCount, 502);
  assert.equal(sheet.getCell('A1').fill.pattern, 'none');
  assert.equal(sheet.getCell('A1').font.bold, true);
  assert.equal(sheet.getCell('F2').value, null);
  assert.equal(sheet.getCell('F2').border.top.style, 'thin');
  assert.equal(sheet.getCell('F2').border.bottom.style, 'thin');
  assert.equal(sheet.getCell('O1').value, 'Chờ hoàn tiền');
  assert.equal(sheet.getCell('O2').value, 50000);
  assert.deepEqual(batchSizes, [500, 500]);
});
