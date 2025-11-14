/**
 * End-to-End Integration Tests
 *
 * These tests simulate complete workflows from start to finish
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { KMSService } from '../src/services/kms';
import {
  generateAccessRequest,
  generateScenarioData,
  executeBatch,
  validateAccessResponse,
  validateAuditLogEntry,
  extractTimestamps,
  validateTimestampSpacing,
  wait
} from './helpers';

describe('End-to-End Workflows', () => {
  let kms: KMSService;

  beforeAll(async () => {
    kms = await KMSService.initialize('e2e-test-kms');
  });

  describe('Complete Access Request Workflow', () => {
    test('should complete full access request lifecycle', async () => {
      // 1. Generate access request
      const request = generateAccessRequest({
        requesterId: 'e2e-user-001',
        purpose: 'Complete workflow test'
      });

      // 2. Submit access request
      const response = await kms.authorizeAccess(request);

      // 3. Verify response
      expect(validateAccessResponse(response)).toBe(true);
      expect(response.granted).toBe(true);
      expect(response.privateKeys).toBeDefined();
      expect(response.privateKeys!.size).toBeGreaterThan(0);

      // 4. Verify audit logs were created
      // Note: Different event types have different actors
      // - ACCESS_REQUEST has actor = requesterId
      // - ACCESS_GRANTED, KEY_GENERATION, KEY_DISTRIBUTION have actor = keyHolderId
      const allLogs = await kms.getAuditLogs();
      const relevantLogs = allLogs.filter(
        log => log.actor === request.requesterId || log.target === request.requesterId
      );
      expect(relevantLogs.length).toBeGreaterThan(0);

      // Verify specific event types exist in all logs
      const allEventTypes = allLogs.map(log => log.eventType);
      expect(allEventTypes).toContain('ACCESS_REQUEST');
      expect(allEventTypes).toContain('ACCESS_GRANTED');
      expect(allEventTypes).toContain('KEY_GENERATION');
      expect(allEventTypes).toContain('KEY_DISTRIBUTION');

      // 5. Verify all audit entries are valid
      relevantLogs.forEach(log => {
        expect(validateAuditLogEntry(log)).toBe(true);
      });
    });

    test('should handle multiple sequential requests', async () => {
      const userId = 'e2e-sequential-user';
      const requestCount = 3;

      for (let i = 0; i < requestCount; i++) {
        const request = generateAccessRequest({
          requesterId: userId,
          purpose: `Sequential request ${i + 1}`
        });

        const response = await kms.authorizeAccess(request);
        expect(response.granted).toBe(true);

        // Small delay between requests
        await wait(100);
      }

      // Verify all requests were logged
      const logs = await kms.getAuditLogs({ actor: userId });
      const requestLogs = logs.filter(log => log.eventType === 'ACCESS_REQUEST');
      expect(requestLogs.length).toBe(requestCount);
    });
  });

  describe('Multi-User Scenario', () => {
    test('should handle multiple users with multiple requests', async () => {
      const scenario = generateScenarioData({
        userCount: 5,
        requestsPerUser: 3,
        timeRangeHours: 24
      });

      // Execute all requests
      const responses = await executeBatch(
        scenario.requests,
        req => kms.authorizeAccess(req),
        { batchSize: 10, delayMs: 50 }
      );

      // Verify all requests were granted
      expect(responses.length).toBe(scenario.requests.length);
      responses.forEach(response => {
        expect(response.granted).toBe(true);
      });

      // Verify audit logs for each user
      for (const userId of scenario.users) {
        const userLogs = await kms.getAuditLogs({ actor: userId });
        expect(userLogs.length).toBeGreaterThan(0);
      }

      // Verify overall statistics
      const stats = await kms.getAuditStats();
      expect(stats.totalEntries).toBeGreaterThan(scenario.requests.length);
      expect(Object.keys(stats.entriesByActor).length).toBeGreaterThanOrEqual(
        scenario.users.length
      );
    });
  });

  describe('Policy Lifecycle', () => {
    test('should manage policy from creation to deletion', async () => {
      // 1. Create policy
      const policyId = 'e2e-policy-lifecycle';
      await kms.addPolicy({
        id: policyId,
        name: 'E2E Lifecycle Policy',
        type: 'custom',
        priority: 50,
        enabled: true,
        description: 'Policy for lifecycle testing'
      });

      // 2. Verify policy exists
      let policy = kms.getPolicy(policyId);
      expect(policy).toBeDefined();
      expect(policy!.enabled).toBe(true);

      // 3. Disable policy
      await kms.disablePolicy(policyId);
      policy = kms.getPolicy(policyId);
      expect(policy!.enabled).toBe(false);

      // 4. Enable policy
      await kms.enablePolicy(policyId);
      policy = kms.getPolicy(policyId);
      expect(policy!.enabled).toBe(true);

      // 5. Delete policy
      const removed = await kms.removePolicy(policyId);
      expect(removed).toBe(true);

      // 6. Verify deletion
      policy = kms.getPolicy(policyId);
      expect(policy).toBeUndefined();
    });
  });

  describe('Audit Log Analysis', () => {
    test('should track complete audit trail', async () => {
      const testUser = 'e2e-audit-analysis-user';

      // Generate some activity
      for (let i = 0; i < 5; i++) {
        await kms.authorizeAccess(
          generateAccessRequest({
            requesterId: testUser,
            purpose: `Audit test ${i}`
          })
        );
      }

      // Analyze audit logs - get ALL logs since events have different actors
      const allLogs = await kms.getAuditLogs();

      // Filter logs related to this user (either as actor or target)
      const userLogs = allLogs.filter(
        log => log.actor === testUser || log.target === testUser
      );

      // Group by event type
      const eventCounts: Record<string, number> = {};
      userLogs.forEach(log => {
        eventCounts[log.eventType] = (eventCounts[log.eventType] || 0) + 1;
      });

      // Each access request should generate multiple event types
      // ACCESS_REQUEST has actor = testUser
      expect(eventCounts['ACCESS_REQUEST']).toBe(5);
      // Other events have target = testUser
      expect(eventCounts['ACCESS_GRANTED']).toBe(5);
      expect(eventCounts['KEY_GENERATION']).toBe(5);
      expect(eventCounts['KEY_DISTRIBUTION']).toBe(5);

      // Verify chronological order
      for (let i = 1; i < userLogs.length; i++) {
        expect(userLogs[i].timestamp).toBeGreaterThanOrEqual(
          userLogs[i - 1].timestamp
        );
      }

      // Verify all logs are successful
      const allSuccessful = userLogs.every(log => log.success === true);
      expect(allSuccessful).toBe(true);
    });
  });

  describe('Time-Based Key Derivation', () => {
    test('should derive correct number of keys for various time ranges', async () => {
      const testCases = [
        { duration: 1000, expectedMin: 2, name: '1 second' },
        { duration: 5000, expectedMin: 6, name: '5 seconds' },
        { duration: 10000, expectedMin: 11, name: '10 seconds' },
        { duration: 30000, expectedMin: 31, name: '30 seconds' }
      ];

      for (const testCase of testCases) {
        const now = Date.now();
        const request = generateAccessRequest({
          requesterId: 'time-based-test-user',
          timeRange: {
            startTime: now,
            endTime: now + testCase.duration
          }
        });

        const response = await kms.authorizeAccess(request);
        expect(response.granted).toBe(true);
        expect(response.privateKeys!.size).toBeGreaterThanOrEqual(
          testCase.expectedMin
        );

        // Verify timestamp spacing (1 second granularity)
        const timestamps = Array.from(response.privateKeys!.keys()).sort(
          (a, b) => a - b
        );
        expect(validateTimestampSpacing(timestamps, 1000, 100)).toBe(true);
      }
    });

    test('should handle requests spanning past to present', async () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      const request = generateAccessRequest({
        requesterId: 'past-to-present-user',
        timeRange: {
          startTime: oneHourAgo,
          endTime: now
        }
      });

      const response = await kms.authorizeAccess(request);
      expect(response.granted).toBe(true);

      // Should have approximately 3600 keys (one per second)
      expect(response.privateKeys!.size).toBeGreaterThan(3500);
      expect(response.privateKeys!.size).toBeLessThan(3700);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle high concurrency correctly', async () => {
      const concurrentRequests = 20;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        generateAccessRequest({
          requesterId: `concurrent-user-${i}`,
          purpose: `Concurrent test ${i}`
        })
      );

      // Execute all requests concurrently
      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => kms.authorizeAccess(req))
      );
      const endTime = Date.now();

      // Verify all requests succeeded
      expect(responses.length).toBe(concurrentRequests);
      responses.forEach(response => {
        expect(response.granted).toBe(true);
        expect(response.privateKeys).toBeDefined();
      });

      // Verify performance (should complete reasonably fast)
      const durationMs = endTime - startTime;
      expect(durationMs).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify audit log integrity
      const stats = await kms.getAuditStats();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(concurrentRequests * 4);
    });
  });

  describe('System Statistics', () => {
    test('should maintain accurate statistics', async () => {
      // Get initial stats
      const initialStats = await kms.getAuditStats();

      // Generate some activity
      const activityCount = 10;
      for (let i = 0; i < activityCount; i++) {
        await kms.authorizeAccess(
          generateAccessRequest({
            requesterId: 'stats-test-user',
            purpose: `Stats test ${i}`
          })
        );
      }

      // Get updated stats
      const updatedStats = await kms.getAuditStats();

      // Verify stats increased
      expect(updatedStats.totalEntries).toBeGreaterThan(
        initialStats.totalEntries
      );

      // Verify success rate is high (should be 1.0 since no denials)
      expect(updatedStats.successRate).toBeGreaterThan(0.95);

      // Verify event type distribution
      expect(updatedStats.entriesByType['ACCESS_REQUEST']).toBeGreaterThanOrEqual(
        activityCount
      );
    });

    test('should track system status over time', async () => {
      const status1 = kms.getStatus();

      // Generate activity
      await kms.authorizeAccess(
        generateAccessRequest({ requesterId: 'status-tracking-user' })
      );

      const status2 = kms.getStatus();

      // Verify status fields
      expect(status2.keyHolderId).toBe(status1.keyHolderId);
      expect(status2.masterKeyStatus).toBe('active');
      expect(status2.keyAlgorithm).toBe('EC P-256');
      expect(status2.auditLogSize).toBeGreaterThan(status1.auditLogSize);
    });
  });

  describe('Error Recovery', () => {
    test('should handle rapid sequential requests without errors', async () => {
      const userId = 'rapid-test-user';
      const rapidCount = 50;

      for (let i = 0; i < rapidCount; i++) {
        const response = await kms.authorizeAccess(
          generateAccessRequest({
            requesterId: userId,
            purpose: `Rapid test ${i}`
          })
        );
        expect(response.granted).toBe(true);
        // No delay between requests
      }

      // Verify all logged correctly
      const logs = await kms.getAuditLogs({ actor: userId });
      const requestLogs = logs.filter(log => log.eventType === 'ACCESS_REQUEST');
      expect(requestLogs.length).toBe(rapidCount);
    });
  });

  describe('Memory and Performance', () => {
    test('should handle large time ranges efficiently', async () => {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 3600000;

      const startTime = Date.now();

      const response = await kms.authorizeAccess({
        requesterId: 'large-range-user',
        timeRange: {
          startTime: twentyFourHoursAgo,
          endTime: now
        },
        purpose: 'Large time range test'
      });

      const duration = Date.now() - startTime;

      expect(response.granted).toBe(true);
      // Should complete within reasonable time (even for 86400 keys)
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // Should have approximately 86400 keys (24 hours * 3600 seconds)
      expect(response.privateKeys!.size).toBeGreaterThan(80000);
    });
  });
});
