/**
 * Setup script to create initial requester and API key
 * Run with: npx tsx scripts/setup-initial-requester.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateApiKeyPair, hashApiKeySecret } from '../src/auth/api-keys';

const prisma = new PrismaClient();

async function setup() {
  console.log('🔧 Setting up initial requester and API key...\n');

  // Create initial requester
  const requester = await prisma.requester.create({
    data: {
      name: 'System Admin',
      description: 'Initial system administrator requester',
      enabled: true,
      metadata: {
        setupDate: new Date().toISOString(),
        isInitial: true
      }
    }
  });

  console.log(`✅ Created requester: ${requester.name} (ID: ${requester.id})`);

  // Generate API key
  const { keyId, keySecret } = generateApiKeyPair();
  const hashedSecret = await hashApiKeySecret(keySecret);

  const apiKey = await prisma.apiKey.create({
    data: {
      keyId,
      keySecret: hashedSecret,
      name: 'Initial Admin Key',
      requesterId: requester.id,
      enabled: true,
      createdBy: 'setup-script'
    }
  });

  console.log(`✅ Created API key: ${apiKey.name} (KeyID: ${apiKey.keyId})\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 YOUR API KEY (save this now, it will not be shown again!):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n${keyId}.${keySecret}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 Usage:');
  console.log(`   Authorization: ApiKey ${keyId}.${keySecret}\n`);
  console.log('🔒 Requester ID for access requests: ' + requester.id);
  console.log('\n✨ Setup complete!\n');

  await prisma.$disconnect();
}

setup().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
