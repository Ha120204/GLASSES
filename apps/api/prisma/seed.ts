import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  if (!email || !password) {
    throw new Error('Cần khai báo SEED_EMAIL và SEED_PASSWORD trước khi seed.');
  }

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Chủ cửa hàng', passwordHash: await bcrypt.hash(password, 12) },
  });

  const setting = await prisma.setting.findFirst();
  if (!setting) {
    await prisma.setting.create({ data: { storeName: 'Cửa hàng kính mắt' } });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
