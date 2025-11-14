/**
 * Integration Tests for KMS API Endpoints
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import type { App } from '../src/index';

// Note: For these tests to work, you need to start the server separately
// or import and create an app instance
const baseURL = 'http://localhost:3001';

describe('KMS API Integration Tests', () => {
  describe('Root & Health Endpoints', () => {
    test('GET / should return API information', async () => {
      const response = await fetch(`${baseURL}/`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('ChronoCrypt KMS API');
      expect(data.version).toBe('1.0.0');
      expect(data.status).toBe('running');
      expect(data.endpoints).toBeDefined();
    });

    test('GET /api/health should return healthy status', async () => {
      const response = await fetch(`${baseURL}/api/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeGreaterThan(0);
      expect(data.components).toBeDefined();
      expect(data.components.keyHolder).toBe('operational');
    });
  });

  describe('Access Request Endpoints', () => {
    test('POST /api/access-requests should accept valid request', async () => {
      const request = {
        requesterId: 'api-test-user-001',
        timeRange: {
          startTime: Date.now() - 60000,
          endTime: Date.now()
        },
        purpose: 'API integration test',
        metadata: {
          test: true
        }
      };

      const response = await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.granted).toBe(true);
      expect(data.privateKeys).toBeDefined();
      expect(Object.keys(data.privateKeys).length).toBeGreaterThan(0);
      expect(data.metadata.keyCount).toBeGreaterThan(0);
    });

    test('POST /api/access-requests should reject invalid request', async () => {
      const invalidRequest = {
        requesterId: 'test-user'
        // Missing timeRange
      };

      const response = await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('GET /api/access-requests should list requests', async () => {
      // First create a request
      await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: 'list-test-user',
          timeRange: {
            startTime: Date.now(),
            endTime: Date.now() + 1000
          }
        })
      });

      // Then list requests
      const response = await fetch(`${baseURL}/api/access-requests`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(0);
      expect(data.limit).toBe(50);
      expect(data.offset).toBe(0);
    });

    test('GET /api/access-requests should filter by requesterId', async () => {
      const testUser = 'filter-api-test-user';

      // Create a request
      await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: testUser,
          timeRange: {
            startTime: Date.now(),
            endTime: Date.now() + 1000
          }
        })
      });

      // Filter by requesterId
      const response = await fetch(
        `${baseURL}/api/access-requests?requesterId=${testUser}`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.requests)).toBe(true);
    });
  });

  describe('Audit Log Endpoints', () => {
    test('GET /api/audit-logs should return audit entries', async () => {
      const response = await fetch(`${baseURL}/api/audit-logs`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(0);
      expect(data.limit).toBe(100);
      expect(data.offset).toBe(0);
    });

    test('GET /api/audit-logs should filter by event type', async () => {
      const response = await fetch(
        `${baseURL}/api/audit-logs?eventType=ACCESS_REQUEST`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.entries)).toBe(true);
      data.entries.forEach((entry: any) => {
        expect(entry.eventType).toBe('ACCESS_REQUEST');
      });
    });

    test('GET /api/audit-logs/stats should return statistics', async () => {
      const response = await fetch(`${baseURL}/api/audit-logs/stats`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalEntries).toBeGreaterThanOrEqual(0);
      expect(data.entriesByType).toBeDefined();
      expect(data.entriesByActor).toBeDefined();
      expect(data.successRate).toBeGreaterThanOrEqual(0);
      expect(data.successRate).toBeLessThanOrEqual(1);
      expect(data.timeRange).toBeDefined();
    });

    test('GET /api/audit-logs should support pagination', async () => {
      const response1 = await fetch(`${baseURL}/api/audit-logs?limit=5&offset=0`);
      const data1 = await response1.json();

      expect(data1.limit).toBe(5);
      expect(data1.offset).toBe(0);
      expect(data1.entries.length).toBeLessThanOrEqual(5);

      const response2 = await fetch(`${baseURL}/api/audit-logs?limit=5&offset=5`);
      const data2 = await response2.json();

      expect(data2.limit).toBe(5);
      expect(data2.offset).toBe(5);
    });
  });

  describe('Policy Endpoints', () => {
    test('GET /api/policies should list all policies', async () => {
      const response = await fetch(`${baseURL}/api/policies`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.policies)).toBe(true);
      expect(data.policies.length).toBeGreaterThan(0);

      // Should have default allow-all policy
      const allowAll = data.policies.find((p: any) => p.id === 'allow-all');
      expect(allowAll).toBeDefined();
    });

    test('GET /api/policies/:id should return specific policy', async () => {
      const response = await fetch(`${baseURL}/api/policies/allow-all`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('allow-all');
      expect(data.name).toBe('Allow All');
    });

    test('GET /api/policies/:id should return 404 for non-existent policy', async () => {
      const response = await fetch(`${baseURL}/api/policies/non-existent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Policy not found');
    });

    test('POST /api/policies should create new policy', async () => {
      const newPolicy = {
        name: 'API Test Policy',
        type: 'custom',
        priority: 100,
        description: 'Test policy created via API',
        config: {
          testMode: true
        }
      };

      const response = await fetch(`${baseURL}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('API Test Policy');
      expect(data.enabled).toBe(true);
      expect(data.createdAt).toBeGreaterThan(0);
    });

    test('PUT /api/policies/:id/disable should disable policy', async () => {
      // First create a policy
      const createResponse = await fetch(`${baseURL}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Disable Test',
          type: 'custom'
        })
      });
      const created = await createResponse.json();

      // Then disable it
      const disableResponse = await fetch(
        `${baseURL}/api/policies/${created.id}/disable`,
        { method: 'PUT' }
      );
      const data = await disableResponse.json();

      expect(disableResponse.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('PUT /api/policies/:id/enable should enable policy', async () => {
      // Create and disable a policy
      const createResponse = await fetch(`${baseURL}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Enable Test',
          type: 'custom'
        })
      });
      const created = await createResponse.json();

      await fetch(`${baseURL}/api/policies/${created.id}/disable`, {
        method: 'PUT'
      });

      // Then enable it
      const enableResponse = await fetch(
        `${baseURL}/api/policies/${created.id}/enable`,
        { method: 'PUT' }
      );
      const data = await enableResponse.json();

      expect(enableResponse.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('DELETE /api/policies/:id should delete custom policy', async () => {
      // Create a policy
      const createResponse = await fetch(`${baseURL}/api/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Delete Test',
          type: 'custom'
        })
      });
      const created = await createResponse.json();

      // Delete it
      const deleteResponse = await fetch(
        `${baseURL}/api/policies/${created.id}`,
        { method: 'DELETE' }
      );
      const data = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify it's gone
      const getResponse = await fetch(`${baseURL}/api/policies/${created.id}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('Key Management Endpoints', () => {
    test('GET /api/keys/master-public should return public key', async () => {
      const response = await fetch(`${baseURL}/api/keys/master-public`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.publicKey).toBeDefined();
      expect(data.publicKey.kty).toBe('EC');
      expect(data.publicKey.crv).toBe('P-256');
      expect(data.publicKey.x).toBeDefined();
      expect(data.publicKey.y).toBeDefined();
      expect(data.algorithm).toBe('ECDH');
      expect(data.curve).toBe('P-256');
      expect(data.usage).toBeDefined();
    });

    test('GET /api/keys/status should return key status', async () => {
      const response = await fetch(`${baseURL}/api/keys/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.masterKeyStatus).toBe('active');
      expect(data.keyAlgorithm).toBe('EC P-256');
      expect(data.keyCreatedAt).toBeGreaterThan(0);
      expect(data.secureStorage).toBe('enabled');
    });
  });

  describe('Statistics Endpoint', () => {
    test('GET /api/stats should return system statistics', async () => {
      const response = await fetch(`${baseURL}/api/stats`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessRequests).toBeDefined();
      expect(data.accessRequests.total).toBeGreaterThanOrEqual(0);
      expect(data.accessRequests.granted).toBeGreaterThanOrEqual(0);
      expect(data.accessRequests.denied).toBeGreaterThanOrEqual(0);
      expect(data.accessRequests.last24Hours).toBeGreaterThanOrEqual(0);

      expect(data.policies).toBeDefined();
      expect(data.policies.total).toBeGreaterThan(0);

      expect(data.auditLog).toBeDefined();
      expect(data.auditLog.totalEntries).toBeGreaterThanOrEqual(0);
      expect(data.auditLog.successRate).toBeGreaterThanOrEqual(0);

      expect(data.keyManagement).toBeDefined();
      expect(data.keyManagement.totalKeysDerivied).toBeGreaterThanOrEqual(0);
      expect(data.keyManagement.averageKeysPerRequest).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CORS', () => {
    test('should support CORS headers', async () => {
      const response = await fetch(`${baseURL}/api/health`, {
        headers: {
          Origin: 'http://localhost:3000'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle missing content type', async () => {
      const response = await fetch(`${baseURL}/api/access-requests`, {
        method: 'POST',
        body: JSON.stringify({
          requesterId: 'test',
          timeRange: { startTime: Date.now(), endTime: Date.now() }
        })
      });

      // Should still work or return appropriate error
      expect(response.status).toBeLessThan(500);
    });
  });
});
