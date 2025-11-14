/**
 * Unit Tests for KMS Service
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { KMSService } from '../src/services/kms';
import type { AccessRequest } from '@siwats/chronocrypt';

describe('KMS Service', () => {
  let kms: KMSService;

  beforeAll(async () => {
    kms = await KMSService.initialize('test-kms');
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const testKms = await KMSService.initialize('init-test');
      expect(testKms).toBeDefined();
    });

    test('should have valid status after initialization', () => {
      const status = kms.getStatus();
      expect(status.keyHolderId).toBe('test-kms');
      expect(status.masterKeyStatus).toBe('active');
      expect(status.keyAlgorithm).toBe('EC P-256');
      expect(status.keyCreatedAt).toBeGreaterThan(0);
    });

    test('should have default allow-all policy', () => {
      const policies = kms.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.some(p => p.id === 'allow-all')).toBe(true);
    });
  });

  describe('Master Public Key', () => {
    test('should export master public key', async () => {
      const publicKey = await kms.getMasterPublicKey();
      expect(publicKey).toBeDefined();
      expect(publicKey.kty).toBe('EC');
      expect(publicKey.crv).toBe('P-256');
      expect(publicKey.x).toBeDefined();
      expect(publicKey.y).toBeDefined();
    });

    test('should have valid public key structure', async () => {
      const publicKey = await kms.getMasterPublicKey();
      expect(typeof publicKey.x).toBe('string');
      expect(typeof publicKey.y).toBe('string');
      expect(publicKey.x!.length).toBeGreaterThan(0);
      expect(publicKey.y!.length).toBeGreaterThan(0);
    });
  });

  describe('Access Authorization', () => {
    test('should grant access for valid request', async () => {
      const request: AccessRequest = {
        requesterId: 'test-user-001',
        timeRange: {
          startTime: Date.now() - 60000,
          endTime: Date.now()
        },
        purpose: 'Unit test access request'
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);
      expect(response.privateKeys).toBeDefined();
      expect(response.privateKeys!.size).toBeGreaterThan(0);
    });

    test('should provide correct number of time-specific keys', async () => {
      const now = Date.now();
      const request: AccessRequest = {
        requesterId: 'test-user-002',
        timeRange: {
          startTime: now,
          endTime: now + 5000 // 5 seconds
        },
        purpose: 'Test key count'
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);
      // Should have at least 6 keys (every 1 second + end time)
      expect(response.privateKeys!.size).toBeGreaterThanOrEqual(6);
    });

    test('should log access request to audit log', async () => {
      const request: AccessRequest = {
        requesterId: 'test-user-003',
        timeRange: {
          startTime: Date.now(),
          endTime: Date.now() + 1000
        },
        purpose: 'Audit log test'
      };

      await kms.authorizeAccess(request);

      const logs = await kms.getAuditLogs({ actor: 'test-user-003' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.eventType === 'ACCESS_REQUEST')).toBe(true);
    });
  });

  describe('Audit Logs', () => {
    test('should retrieve all audit logs', async () => {
      const logs = await kms.getAuditLogs();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should filter audit logs by actor', async () => {
      const actorId = 'filter-test-user';
      const request: AccessRequest = {
        requesterId: actorId,
        timeRange: {
          startTime: Date.now(),
          endTime: Date.now() + 1000
        }
      };

      await kms.authorizeAccess(request);

      const logs = await kms.getAuditLogs({ actor: actorId });
      expect(logs.every(log => log.actor === actorId)).toBe(true);
    });

    test('should filter audit logs by event type', async () => {
      const logs = await kms.getAuditLogs({ eventType: 'ACCESS_REQUEST' });
      expect(logs.every(log => log.eventType === 'ACCESS_REQUEST')).toBe(true);
    });

    test('should provide audit statistics', async () => {
      const stats = await kms.getAuditStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.entriesByType).toBeDefined();
      expect(stats.entriesByActor).toBeDefined();
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });

    test('should track multiple event types in audit log', async () => {
      const stats = await kms.getAuditStats();
      const eventTypes = Object.keys(stats.entriesByType);

      // Should have at least ACCESS_REQUEST and ACCESS_GRANTED
      expect(eventTypes.length).toBeGreaterThanOrEqual(2);
      expect(eventTypes).toContain('ACCESS_REQUEST');
      expect(eventTypes).toContain('ACCESS_GRANTED');
    });
  });

  describe('Policy Management', () => {
    test('should list all policies', () => {
      const policies = kms.getPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });

    test('should retrieve specific policy by id', () => {
      const policy = kms.getPolicy('allow-all');
      expect(policy).toBeDefined();
      expect(policy!.id).toBe('allow-all');
      expect(policy!.name).toBe('Allow All');
    });

    test('should add new policy', async () => {
      const newPolicy = {
        id: 'test-policy-001',
        name: 'Test Policy',
        type: 'custom' as const,
        priority: 100,
        enabled: true,
        description: 'Test policy for unit tests'
      };

      await kms.addPolicy(newPolicy);

      const retrieved = kms.getPolicy('test-policy-001');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Test Policy');
    });

    test('should enable and disable policies', async () => {
      const policyId = 'test-policy-toggle';
      await kms.addPolicy({
        id: policyId,
        name: 'Toggle Test',
        type: 'custom',
        priority: 50,
        enabled: true
      });

      // Disable
      await kms.disablePolicy(policyId);
      let policy = kms.getPolicy(policyId);
      expect(policy!.enabled).toBe(false);

      // Enable
      await kms.enablePolicy(policyId);
      policy = kms.getPolicy(policyId);
      expect(policy!.enabled).toBe(true);
    });

    test('should remove custom policy', async () => {
      const policyId = 'test-policy-remove';
      await kms.addPolicy({
        id: policyId,
        name: 'Remove Test',
        type: 'custom',
        priority: 50,
        enabled: true
      });

      const removed = await kms.removePolicy(policyId);
      expect(removed).toBe(true);

      const retrieved = kms.getPolicy(policyId);
      expect(retrieved).toBeUndefined();
    });

    test('should not remove built-in allow-all policy', async () => {
      await expect(kms.removePolicy('allow-all')).rejects.toThrow();
    });
  });

  describe('Status and Health', () => {
    test('should return valid status information', () => {
      const status = kms.getStatus();
      expect(status.keyHolderId).toBe('test-kms');
      expect(status.masterKeyStatus).toBe('active');
      expect(status.keyAlgorithm).toBe('EC P-256');
      expect(status.keyCreatedAt).toBeGreaterThan(0);
      expect(status.auditLogSize).toBeGreaterThan(0);
      expect(status.policiesCount).toBeGreaterThan(0);
    });

    test('should track audit log size', async () => {
      const statusBefore = kms.getStatus();

      // Generate some activity
      await kms.authorizeAccess({
        requesterId: 'size-test-user',
        timeRange: {
          startTime: Date.now(),
          endTime: Date.now() + 1000
        }
      });

      const statusAfter = kms.getStatus();
      expect(statusAfter.auditLogSize).toBeGreaterThan(statusBefore.auditLogSize);
    });
  });

  describe('Time Range Handling', () => {
    test('should handle single timestamp request', async () => {
      const timestamp = Date.now();
      const request: AccessRequest = {
        requesterId: 'single-ts-user',
        timeRange: {
          startTime: timestamp,
          endTime: timestamp
        }
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);
      expect(response.privateKeys!.size).toBe(1);
      expect(response.privateKeys!.has(timestamp)).toBe(true);
    });

    test('should handle large time range', async () => {
      const now = Date.now();
      const request: AccessRequest = {
        requesterId: 'large-range-user',
        timeRange: {
          startTime: now,
          endTime: now + 60000 // 1 minute
        }
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);
      // Should have ~60 keys (every second)
      expect(response.privateKeys!.size).toBeGreaterThanOrEqual(60);
    });

    test('should handle past timestamps', async () => {
      const past = Date.now() - 3600000; // 1 hour ago
      const request: AccessRequest = {
        requesterId: 'past-time-user',
        timeRange: {
          startTime: past,
          endTime: past + 5000
        }
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);
      expect(response.privateKeys!.size).toBeGreaterThan(0);
    });
  });

  describe('Metadata Handling', () => {
    test('should accept and process request metadata', async () => {
      const request: AccessRequest = {
        requesterId: 'metadata-user',
        timeRange: {
          startTime: Date.now(),
          endTime: Date.now() + 1000
        },
        purpose: 'Test with metadata',
        metadata: {
          department: 'Engineering',
          project: 'Test-001',
          priority: 'high'
        }
      };

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);

      // Verify metadata was logged
      const logs = await kms.getAuditLogs({ actor: 'metadata-user' });
      const requestLog = logs.find(log => log.eventType === 'ACCESS_REQUEST');
      expect(requestLog?.details?.metadata).toBeDefined();
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent access requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        requesterId: `concurrent-user-${i}`,
        timeRange: {
          startTime: Date.now(),
          endTime: Date.now() + 1000
        },
        purpose: `Concurrent test ${i}`
      }));

      const responses = await Promise.all(
        requests.map(req => kms.authorizeAccess(req))
      );

      expect(responses.length).toBe(5);
      responses.forEach(response => {
        expect(response.granted).toBe(true);
        expect(response.privateKeys).toBeDefined();
      });
    });
  });
});
