import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('admin123!@#');

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: 'admin',
      email: 'admin@vpn-platform.local',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log('Seed completed: admin user created (username: admin / admin123!@#)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
