/**
 * Database Seed Script
 *
 * Initializes the database with default data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default allow-all policy
  const allowAllPolicy = await prisma.policy.upsert({
    where: { id: 'allow-all' },
    update: {},
    create: {
      id: 'allow-all',
      name: 'Allow All',
      type: 'built-in',
      priority: -1000,
      enabled: true,
      description: 'Allows all access requests (for development)',
      config: {},
    },
  });

  console.log('✅ Created default policy:', allowAllPolicy.name);

  // Create example policies
  const timeBasedPolicy = await prisma.policy.upsert({
    where: { id: 'business-hours-only' },
    update: {},
    create: {
      id: 'business-hours-only',
      name: 'Business Hours Only',
      type: 'time-based',
      priority: 100,
      enabled: false,
      description: 'Only allow access requests during business hours (9 AM - 5 PM UTC)',
      config: {
        allowedHoursUtc: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        timezone: 'UTC',
      },
    },
  });

  console.log('✅ Created time-based policy:', timeBasedPolicy.name);

  const durationLimitPolicy = await prisma.policy.upsert({
    where: { id: 'max-duration-1hour' },
    update: {},
    create: {
      id: 'max-duration-1hour',
      name: 'Maximum Duration 1 Hour',
      type: 'duration-limit',
      priority: 50,
      enabled: false,
      description: 'Limit time range requests to maximum 1 hour',
      config: {
        maxDurationMs: 3600000, // 1 hour
      },
    },
  });

  console.log('✅ Created duration limit policy:', durationLimitPolicy.name);

  // Create example requesters
  const requester1 = await prisma.requester.upsert({
    where: { requesterId: 'analyst-001' },
    update: {},
    create: {
      requesterId: 'analyst-001',
      name: 'Data Analyst 1',
      department: 'Analytics',
      email: 'analyst1@example.com',
      enabled: true,
      metadata: {
        role: 'senior',
        clearanceLevel: 'high',
      },
    },
  });

  console.log('✅ Created requester:', requester1.name);

  const requester2 = await prisma.requester.upsert({
    where: { requesterId: 'developer-001' },
    update: {},
    create: {
      requesterId: 'developer-001',
      name: 'Developer 1',
      department: 'Engineering',
      email: 'dev1@example.com',
      enabled: true,
      metadata: {
        role: 'developer',
        team: 'backend',
      },
    },
  });

  console.log('✅ Created requester:', requester2.name);

  console.log('🎉 Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
