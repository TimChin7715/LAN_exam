import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const SEED_USERNAME = 'teacher_admin';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password?.length) {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required for seeding');
  }

  const passwordHash = await argon2.hash(password);

  await prisma.teacher.upsert({
    where: { username: SEED_USERNAME },
    create: {
      username: SEED_USERNAME,
      passwordHash,
      displayName: 'Administrator',
      mustChangePassword: true,
    },
    update: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log(`Seeded teacher: ${SEED_USERNAME} (mustChangePassword=true)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
