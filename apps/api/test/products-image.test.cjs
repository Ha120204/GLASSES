const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');
const { ProductsService } = require('../dist/src/products/products.service.js');

const makePng = () => sharp({ create: { width: 400, height: 240, channels: 3, background: '#2266aa' } }).png().toBuffer();

test('product image rejects invalid content without writing to storage', async () => {
  const png = await makePng();
  let writes = 0;
  const service = new ProductsService({
    product: { findFirst: async () => ({ id: 'product-1' }) },
    productImage: { upsert: () => { writes += 1; } },
  });
  for (const file of [
    { buffer: Buffer.from('<svg></svg>'), size: 11, mimetype: 'image/svg+xml' },
    { buffer: png, size: png.length, mimetype: 'image/jpeg' },
    { buffer: png.subarray(0, 12), size: 12, mimetype: 'image/png' },
    { buffer: png, size: 5 * 1024 * 1024 + 1, mimetype: 'image/png' },
  ]) {
    await assert.rejects(service.saveImage('product-1', file), (error) => error.getStatus() === 400);
  }
  assert.equal(writes, 0);
});

test('product image is saved separately from the product record and can be removed', async () => {
  const png = await makePng();
  const operations = [];
  const product = { id: 'product-1', imageUpdatedAt: new Date() };
  let storedImage;
  const service = new ProductsService({
    product: {
      findFirst: async () => product,
      update: async (args) => { operations.push(args); return { ...product, ...args.data }; },
    },
    productImage: {
      upsert: async (args) => { operations.push(args); storedImage = args.create; return {}; },
      deleteMany: async (args) => { operations.push(args); return { count: 1 }; },
      findFirst: async () => storedImage,
    },
    $transaction: (promises) => Promise.all(promises),
  });
  const saved = await service.saveImage('product-1', { buffer: png, size: png.length, mimetype: 'image/png' });
  assert.ok(saved.imageUpdatedAt instanceof Date);
  assert.equal(operations[0].create.mimeType, 'image/webp');
  const full = await service.getImage('product-1');
  const thumbnail = await service.getImage('product-1', 'thumbnail');
  assert.equal((await sharp(Buffer.from(full.content)).metadata()).format, 'webp');
  assert.equal((await sharp(Buffer.from(full.content)).metadata()).width, 400);
  assert.equal((await sharp(Buffer.from(thumbnail.content)).metadata()).width, 192);
  assert.ok(thumbnail.content.length < full.content.length);
  const removed = await service.removeImage('product-1');
  assert.equal(removed.imageUpdatedAt, null);
  assert.deepEqual(operations[2], { where: { productId: 'product-1' } });
});
