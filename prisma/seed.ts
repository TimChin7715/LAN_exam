import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const SESSION_SEED_USERNAME = 'teacher_admin';
const adminAuthMode = (process.env.ADMIN_AUTH_MODE ?? 'disabled').toLowerCase();

const prisma = new PrismaClient();

async function seedDisabledLocalAdmin(): Promise<void> {
  const username = process.env.LOCAL_ADMIN_USERNAME ?? 'local_exam_admin';
  const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));

  await prisma.teacher.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      displayName: '本地考试管理',
      mustChangePassword: false,
    },
    update: {
      mustChangePassword: false,
    },
  });

  console.log(`Seeded local admin: ${username} (ADMIN_AUTH_MODE=disabled)`);
}

async function seedSessionAdmin(): Promise<void> {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password?.length) {
    throw new Error(
      'SEED_ADMIN_PASSWORD environment variable is required when ADMIN_AUTH_MODE=session',
    );
  }

  const passwordHash = await argon2.hash(password);

  await prisma.teacher.upsert({
    where: { username: SESSION_SEED_USERNAME },
    create: {
      username: SESSION_SEED_USERNAME,
      passwordHash,
      displayName: 'Administrator',
      mustChangePassword: true,
    },
    update: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log(
    `Seeded teacher: ${SESSION_SEED_USERNAME} (mustChangePassword=true)`,
  );
}

async function main() {
  if (adminAuthMode === 'disabled') {
    await seedDisabledLocalAdmin();
    return;
  }

  await seedSessionAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
