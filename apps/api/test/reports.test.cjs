const assert = require('node:assert/strict');
const test = require('node:test');
const { ReportsService } = require('../dist/src/reports/reports.service.js');

test('product sales include order discounts and allocate every dong exactly once', async () => {
  const createdAt = new Date('2026-10-15T03:00:00.000Z');
  const orders = [
    {
      status: 'DELIVERED', total: 90, deposit: 0, createdAt, archivedAt: createdAt, payments: [],
      items: [{ name: 'A', qty: 1, unitPrice: 60 }, { name: 'B', qty: 1, unitPrice: 40 }],
    },
    {
      status: 'IN_PROGRESS', total: 2, deposit: 0, createdAt, payments: [],
      items: [{ name: 'C', qty: 1, unitPrice: 1 }, { name: 'B', qty: 1, unitPrice: 1 }, { name: 'A', qty: 1, unitPrice: 1 }],
    },
    {
      status: 'CANCELLED', total: 100, deposit: 0, createdAt, payments: [],
      items: [{ name: 'Cancelled', qty: 1, unitPrice: 100 }],
    },
  ];
  const service = new ReportsService({
    order: { findMany: async ({ where }) => orders.filter((order) => !Object.hasOwn(where, 'archivedAt') || (where.archivedAt === null ? !order.archivedAt : Boolean(order.archivedAt))) },
    payment: { findMany: async () => [] },
    $transaction: (queries) => Promise.all(queries),
  });

  const report = await service.overview({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  assert.equal(report.summary.orderSales, 92);
  assert.equal(report.summary.orderCount, 2);
  assert.deepEqual(report.topProducts, [
    { name: 'A', qty: 2, sales: 55 },
    { name: 'B', qty: 2, sales: 37 },
    { name: 'C', qty: 1, sales: 0 },
  ]);
  assert.equal(report.topProducts.reduce((sum, product) => sum + product.sales, 0), report.summary.orderSales);
});

test('archived sales stay in history while the dashboard hides archived operational orders', async () => {
  const createdAt = new Date();
  const orders = [
    { id: 'archived', code: 'DH-1', status: 'DELIVERED', total: 100, deposit: 100, archivedAt: createdAt, createdAt, dueDate: null, payments: [], customer: { name: 'A', phone: '1' } },
    { id: 'open', code: 'DH-2', status: 'IN_PROGRESS', total: 200, deposit: 0, archivedAt: null, createdAt, dueDate: null, payments: [], customer: { name: 'B', phone: '2' } },
  ];
  const matches = (order, where) => {
    if (where.archivedAt === null && order.archivedAt !== null) return false;
    if (where.status?.in && !where.status.in.includes(order.status)) return false;
    if (where.createdAt?.gte && order.createdAt < where.createdAt.gte) return false;
    if (where.createdAt?.lte && order.createdAt > where.createdAt.lte) return false;
    if (where.dueDate && !order.dueDate) return false;
    return true;
  };
  const service = new ReportsService({
    order: {
      findMany: async ({ where, take }) => orders.filter((order) => matches(order, where)).slice(0, take),
      count: async ({ where }) => orders.filter((order) => matches(order, where)).length,
    },
    payment: { findMany: async () => [] },
    orderStatusHistory: { count: async () => 1 },
    $transaction: (queries) => Promise.all(queries),
  });

  const dashboard = await service.dashboard();
  assert.equal(dashboard.summary.collectedToday, 100);
  assert.equal(dashboard.summary.completedToday, 1);
  assert.equal(dashboard.summary.outstanding, 200);
  assert.equal(dashboard.summary.inProgress, 1);
  assert.deepEqual(dashboard.recentOrders.map(({ id }) => id), ['open']);
  assert.equal(dashboard.dailySales.reduce((sum, day) => sum + day.sales, 0), 300);
});
