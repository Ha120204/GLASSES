const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { OrdersService } = require('../dist/src/orders/orders.service.js');
const { OrderExcelService } = require('../dist/src/orders/order-excel.service.js');

const normalize = (value) => Array.isArray(value)
  ? value.map(normalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]))
    : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');

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
  assert.deepEqual(listWhere.map(({ archivedAt, status }) => ({ archivedAt, status })), [
    { archivedAt: null, status: { not: 'CANCELLED' } },
    { archivedAt: { not: null }, status: undefined },
  ]);
  const activeExport = await excel.createWhere(query);
  const archivedExport = await excel.createWhere({ ...query, archiveView: 'ARCHIVED' });
  assert.deepEqual({ archivedAt: activeExport.archivedAt, status: activeExport.status }, { archivedAt: null, status: { not: 'CANCELLED' } });
  assert.deepEqual({ archivedAt: archivedExport.archivedAt, status: archivedExport.status }, { archivedAt: { not: null }, status: undefined });
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
  assert.equal(workbook.getWorksheet('Đơn hàng').rowCount, 502);
  assert.deepEqual(batchSizes, [500, 500]);
});
