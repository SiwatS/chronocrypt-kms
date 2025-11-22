/**
 * API Key Authentication System
 *
 * Handles API key generation, validation, and management
 */

import { randomBytes } from 'crypto';
import { hash, compare } from 'bcrypt';
import type { PrismaClient } from '@prisma/client';

const BCRYPT_ROUNDS = 10;

/**
 * Generate a new API key pair
 * Returns both the keyId (public) and keySecret (only shown once)
 */
export function generateApiKeyPair(): { keyId: string; keySecret: string } {
  // Generate keyId (public identifier)
  const keyIdBytes = randomBytes(16).toString('hex');
  const keyId = `ck_${keyIdBytes}`;

  // Generate keySecret (secret part)
  const keySecretBytes = randomBytes(32).toString('base64url');
  const keySecret = `sk_${keySecretBytes}`;

  return { keyId, keySecret };
}

/**
 * Hash an API key secret for storage
 */
export async function hashApiKeySecret(secret: string): Promise<string> {
  return await hash(secret, BCRYPT_ROUNDS);
}

/**
 * Verify an API key secret against its hash
 */
export async function verifyApiKeySecret(secret: string, hashedSecret: string): Promise<boolean> {
  return await compare(secret, hashedSecret);
}

/**
 * Validate API key and return associated requester information
 * Updates lastUsedAt timestamp
 */
export async function validateApiKey(
  prisma: PrismaClient,
  fullApiKey: string
): Promise<{ keyId: string; requesterId: string; requesterName: string } | null> {
  // Parse the API key format: keyId.keySecret
  // Example: ck_abc123.sk_xyz789
  const parts = fullApiKey.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [keyId, keySecret] = parts;

  // Look up the API key
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyId },
    include: { requester: true }
  });

  if (!apiKey) {
    return null;
  }

  // Check if key is enabled
  if (!apiKey.enabled) {
    return null;
  }

  // Check if key is expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Check if requester is enabled
  if (!apiKey.requester.enabled) {
    return null;
  }

  // Verify the secret
  const isValid = await verifyApiKeySecret(keySecret, apiKey.keySecret);
  if (!isValid) {
    return null;
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => {}); // Ignore errors

  return {
    keyId: apiKey.keyId,
    requesterId: apiKey.requesterId,
    requesterName: apiKey.requester.name
  };
}

/**
 * Create API key authentication middleware for Elysia
 */
export function createApiKeyMiddleware(prisma: PrismaClient) {
  return async function requireApiKey({ headers, set }: any) {
    const authHeader = headers.authorization || headers.Authorization;

    if (!authHeader || !authHeader.startsWith('ApiKey ')) {
      set.status = 401;
      return {
        error: 'Unauthorized',
        message: 'API key required',
        format: 'Authorization: ApiKey <keyId>.<keySecret>'
      };
    }

    const apiKey = authHeader.substring(7); // Remove 'ApiKey ' prefix
    const validated = await validateApiKey(prisma, apiKey);

    if (!validated) {
      set.status = 401;
      return {
        error: 'Unauthorized',
        message: 'Invalid or expired API key'
      };
    }

    // Return validated context for use in route handlers
    return validated;
  };
}
