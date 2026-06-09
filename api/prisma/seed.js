import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SUPER = {
  email: (process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@university.edu').toLowerCase(),
  password: process.env.SEED_SUPERADMIN_PASSWORD || 'Admin@123',
  name: process.env.SEED_SUPERADMIN_NAME || 'Super Admin',
};

const DEFAULT_CATEGORIES = [
  { name: 'IT / Network', defaultTeam: 'Network', defaultSlaHours: 24 },
  { name: 'Hostel', defaultTeam: 'Facilities', defaultSlaHours: 48 },
  { name: 'Examinations', defaultTeam: 'Exams', defaultSlaHours: 24 },
  { name: 'Accounts', defaultTeam: 'Finance', defaultSlaHours: 48 },
  { name: 'Library', defaultTeam: 'Library', defaultSlaHours: 72 },
];

async function main() {
  // Super Admin (idempotent)
  const passwordHash = await bcrypt.hash(SUPER.password, 10);
  const admin = await prisma.user.upsert({
    where: { email: SUPER.email },
    update: {},
    create: {
      name: SUPER.name,
      email: SUPER.email,
      passwordHash,
      role: 'SUPER_ADMIN',
      department: 'Administration',
    },
  });
  console.log(`✓ Super Admin ready: ${admin.email}`);

  // Default categories (idempotent)
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }
  console.log(`✓ ${DEFAULT_CATEGORIES.length} categories ready`);

  // Ticket key counter
  await prisma.counter.upsert({
    where: { id: 'ticket' },
    update: {},
    create: { id: 'ticket', value: 100 },
  });
  console.log('✓ Ticket counter ready (keys start at UNIV-101)');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
