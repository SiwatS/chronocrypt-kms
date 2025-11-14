/**
 * Test Helpers and Utilities
 */

import type { AccessRequest, TimeRange } from '@siwats/chronocrypt';

/**
 * Generate a random requester ID
 */
export function generateRequesterId(prefix: string = 'test-user'): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${random}`;
}

/**
 * Generate a time range relative to now
 */
export function generateTimeRange(
  startOffsetMs: number = -60000,
  endOffsetMs: number = 0
): TimeRange {
  const now = Date.now();
  return {
    startTime: now + startOffsetMs,
    endTime: now + endOffsetMs
  };
}

/**
 * Generate a complete access request
 */
export function generateAccessRequest(
  options?: Partial<AccessRequest>
): AccessRequest {
  return {
    requesterId: options?.requesterId || generateRequesterId(),
    timeRange: options?.timeRange || generateTimeRange(),
    purpose: options?.purpose || 'Test access request',
    metadata: options?.metadata
  };
}

/**
 * Generate multiple access requests
 */
export function generateAccessRequests(
  count: number,
  options?: Partial<AccessRequest>
): AccessRequest[] {
  return Array.from({ length: count }, () => generateAccessRequest(options));
}

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random policy configuration
 */
export function generatePolicyConfig(prefix: string = 'test-policy') {
  const id = `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
  return {
    id,
    name: `${prefix} ${id}`,
    type: 'custom' as const,
    priority: Math.floor(Math.random() * 100),
    enabled: true,
    description: `Test policy ${id}`,
    config: {
      testMode: true
    }
  };
}

/**
 * Calculate expected number of keys for a time range
 * Assumes 1 second granularity
 */
export function calculateExpectedKeyCount(timeRange: TimeRange): number {
  const durationMs = timeRange.endTime - timeRange.startTime;
  const seconds = Math.ceil(durationMs / 1000);
  return seconds + 1; // +1 for the end time
}

/**
 * Validate access response structure
 */
export function validateAccessResponse(response: any): boolean {
  if (!response || typeof response !== 'object') return false;
  if (typeof response.granted !== 'boolean') return false;

  if (response.granted) {
    if (!response.privateKeys) return false;
    if (typeof response.privateKeys !== 'object') return false;
  } else {
    if (!response.denialReason || typeof response.denialReason !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Validate audit log entry structure
 */
export function validateAuditLogEntry(entry: any): boolean {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.id || typeof entry.id !== 'string') return false;
  if (!entry.timestamp || typeof entry.timestamp !== 'number') return false;
  if (!entry.eventType || typeof entry.eventType !== 'string') return false;
  if (!entry.actor || typeof entry.actor !== 'string') return false;
  if (typeof entry.success !== 'boolean') return false;

  return true;
}

/**
 * Validate policy structure
 */
export function validatePolicy(policy: any): boolean {
  if (!policy || typeof policy !== 'object') return false;
  if (!policy.id || typeof policy.id !== 'string') return false;
  if (!policy.name || typeof policy.name !== 'string') return false;
  if (!policy.type || typeof policy.type !== 'string') return false;
  if (typeof policy.enabled !== 'boolean') return false;

  return true;
}

/**
 * Generate test data for multiple users over time
 */
export function generateScenarioData(options: {
  userCount: number;
  requestsPerUser: number;
  timeRangeHours: number;
}) {
  const { userCount, requestsPerUser, timeRangeHours } = options;
  const users: string[] = [];
  const requests: AccessRequest[] = [];

  // Generate users
  for (let i = 0; i < userCount; i++) {
    users.push(`scenario-user-${i.toString().padStart(3, '0')}`);
  }

  // Generate requests for each user
  for (const userId of users) {
    for (let i = 0; i < requestsPerUser; i++) {
      const hoursAgo = Math.random() * timeRangeHours;
      const startTime = Date.now() - hoursAgo * 3600000;
      const duration = Math.random() * 3600000; // Random duration up to 1 hour

      requests.push({
        requesterId: userId,
        timeRange: {
          startTime: Math.floor(startTime),
          endTime: Math.floor(startTime + duration)
        },
        purpose: `Scenario test request ${i}`,
        metadata: {
          scenario: true,
          requestNumber: i
        }
      });
    }
  }

  return { users, requests };
}

/**
 * Batch executor for async operations with rate limiting
 */
export async function executeBatch<T, R>(
  items: T[],
  executor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayMs?: number;
  } = {}
): Promise<R[]> {
  const { batchSize = 5, delayMs = 100 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(executor));
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await wait(delayMs);
    }
  }

  return results;
}

/**
 * Assert that a value is within an expected range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  if (value < min || value > max) {
    throw new Error(
      message ||
        `Expected ${value} to be between ${min} and ${max}`
    );
  }
}

/**
 * Compare two timestamps with tolerance
 */
export function timestampsEqual(
  t1: number,
  t2: number,
  toleranceMs: number = 1000
): boolean {
  return Math.abs(t1 - t2) <= toleranceMs;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract timestamps from private keys object
 */
export function extractTimestamps(privateKeys: Record<string, string>): number[] {
  return Object.keys(privateKeys).map(Number).sort((a, b) => a - b);
}

/**
 * Validate that timestamps are evenly spaced
 */
export function validateTimestampSpacing(
  timestamps: number[],
  expectedGranularityMs: number = 1000,
  toleranceMs: number = 100
): boolean {
  if (timestamps.length < 2) return true;

  for (let i = 1; i < timestamps.length; i++) {
    const spacing = timestamps[i] - timestamps[i - 1];
    if (Math.abs(spacing - expectedGranularityMs) > toleranceMs) {
      return false;
    }
  }

  return true;
}
