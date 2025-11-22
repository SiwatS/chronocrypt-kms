import { hash, compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store (username -> sessionId -> expiry)
interface Session {
  sessionId: string;
  username: string;
  adminId: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, BCRYPT_ROUNDS);
}

/**
 * Validate a password against a bcrypt hash
 */
export async function validatePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  try {
    return await compare(password, passwordHash);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create a new session for an admin user
 */
export function createSession(adminId: string, username: string): string {
  const sessionId = generateSessionId();
  const now = Date.now();

  sessions.set(sessionId, {
    sessionId,
    username,
    adminId,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_MS,
  });

  return sessionId;
}

/**
 * Validate a session and return admin info if valid
 */
export function validateSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Delete a session (logout)
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupExpiredSessions, 15 * 60 * 1000);

/**
 * Authenticate admin credentials
 */
export async function authenticateAdmin(
  prisma: PrismaClient,
  username: string,
  password: string
): Promise<{ adminId: string; username: string } | null> {
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || !admin.enabled) {
    return null;
  }

  const isValid = await validatePassword(password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    adminId: admin.id,
    username: admin.username,
  };
}

/**
 * Middleware to protect admin routes
 */
export function createAdminMiddleware(prisma: PrismaClient) {
  return async ({ headers }: { headers: Record<string, string | undefined> }) => {
    const sessionId = headers['authorization']?.replace('Bearer ', '');

    if (!sessionId) {
      throw new Error('Unauthorized: No session provided');
    }

    const session = validateSession(sessionId);
    if (!session) {
      throw new Error('Unauthorized: Invalid or expired session');
    }

    // Verify admin still exists and is enabled
    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
    });

    if (!admin || !admin.enabled) {
      deleteSession(sessionId);
      throw new Error('Unauthorized: Admin account disabled or deleted');
    }

    return {
      admin: {
        id: admin.id,
        username: admin.username,
      },
    };
  };
}
