/**
 * ChronoCrypt KMS Backend API
 *
 * Elysia-based REST API for Key Management System
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { KMSService } from './services/kms';
import type { AccessRequest, TimeRange } from '@siwats/chronocrypt';

// Initialize KMS Service
let kms: KMSService;

const app = new Elysia()
  .use(cors())
  .onStart(async () => {
    console.log('🔐 Initializing ChronoCrypt KMS...');
    kms = await KMSService.initialize('kms-main');
    console.log('✅ KMS Service initialized');
  })

  // Root endpoint
  .get('/', () => ({
    name: 'ChronoCrypt KMS API',
    version: '1.0.0',
    status: 'running',
    description: 'Key Management System for temporal data access control',
    endpoints: {
      accessRequests: '/api/access-requests',
      auditLogs: '/api/audit-logs',
      policies: '/api/policies',
      keys: '/api/keys',
      stats: '/api/stats',
      health: '/api/health'
    }
  }))

  // Health check
  .get('/api/health', () => ({
    status: 'healthy',
    timestamp: Date.now(),
    components: {
      keyHolder: 'operational',
      auditLog: 'operational',
      policyEngine: 'operational'
    }
  }))

  // ============================================================================
  // ACCESS REQUEST MANAGEMENT
  // ============================================================================

  /**
   * POST /api/access-requests
   * Submit a new access request
   */
  .post('/api/access-requests', async ({ body, set }) => {
    try {
      const request = body as AccessRequest;

      // Validate request
      if (!request.requesterId || !request.timeRange) {
        set.status = 400;
        return {
          error: 'Invalid request',
          message: 'requesterId and timeRange are required'
        };
      }

      // Process the access request
      const response = await kms.authorizeAccess(request);

      // If granted, convert CryptoKey objects to exportable format
      if (response.granted && response.privateKeys) {
        const exportedKeys: Record<string, string> = {};

        for (const [timestamp, key] of response.privateKeys.entries()) {
          // Export the key to JWK format and then base64 encode it
          const jwk = await crypto.subtle.exportKey('jwk', key);
          exportedKeys[timestamp.toString()] = btoa(JSON.stringify(jwk));
        }

        return {
          granted: true,
          privateKeys: exportedKeys,
          metadata: {
            keyCount: response.privateKeys.size,
            granularityMs: 1000
          }
        };
      }

      return {
        granted: false,
        denialReason: response.denialReason
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * GET /api/access-requests
   * List access requests from audit log
   */
  .get('/api/access-requests', async ({ query, set }) => {
    try {
      const {
        requesterId,
        startTime,
        endTime,
        status,
        limit = '50',
        offset = '0'
      } = query as Record<string, string>;

      let entries = await kms.getAuditLogs();

      // Filter by requesterId
      if (requesterId) {
        entries = entries.filter(e => e.actor === requesterId);
      }

      // Filter by time range
      if (startTime && endTime) {
        const start = parseInt(startTime);
        const end = parseInt(endTime);
        entries = entries.filter(e => e.timestamp >= start && e.timestamp <= end);
      }

      // Filter by status (granted/denied)
      if (status === 'granted') {
        entries = entries.filter(e => e.eventType === 'ACCESS_GRANTED');
      } else if (status === 'denied') {
        entries = entries.filter(e => e.eventType === 'ACCESS_DENIED');
      }

      // Apply pagination
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const paginatedEntries = entries.slice(offsetNum, offsetNum + limitNum);

      // Transform to request format
      const requests = paginatedEntries
        .filter(e => e.eventType === 'ACCESS_REQUEST')
        .map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          requesterId: e.actor,
          timeRange: e.timeRange,
          purpose: e.details?.purpose,
          status: entries.find(
            ae => ae.actor === e.actor &&
            ae.timestamp > e.timestamp &&
            (ae.eventType === 'ACCESS_GRANTED' || ae.eventType === 'ACCESS_DENIED')
          )?.eventType === 'ACCESS_GRANTED' ? 'granted' : 'denied'
        }));

      return {
        requests,
        total: requests.length,
        limit: limitNum,
        offset: offsetNum
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // ============================================================================
  // AUDIT LOG MANAGEMENT
  // ============================================================================

  /**
   * GET /api/audit-logs
   * Query audit logs with filtering
   */
  .get('/api/audit-logs', async ({ query, set }) => {
    try {
      const {
        eventType,
        actor,
        startTime,
        endTime,
        success,
        limit = '100',
        offset = '0'
      } = query as Record<string, string>;

      let entries = await kms.getAuditLogs();

      // Filter by event type
      if (eventType) {
        entries = entries.filter(e => e.eventType === eventType);
      }

      // Filter by actor
      if (actor) {
        entries = entries.filter(e => e.actor === actor);
      }

      // Filter by time range
      if (startTime && endTime) {
        const start = parseInt(startTime);
        const end = parseInt(endTime);
        entries = entries.filter(e => e.timestamp >= start && e.timestamp <= end);
      }

      // Filter by success
      if (success !== undefined) {
        const successBool = success === 'true';
        entries = entries.filter(e => e.success === successBool);
      }

      // Apply pagination
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const paginatedEntries = entries.slice(offsetNum, offsetNum + limitNum);

      return {
        entries: paginatedEntries,
        total: entries.length,
        limit: limitNum,
        offset: offsetNum
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * GET /api/audit-logs/stats
   * Get audit log statistics
   */
  .get('/api/audit-logs/stats', async ({ set }) => {
    try {
      const stats = await kms.getAuditStats();
      const allEntries = await kms.getAuditLogs();

      const timestamps = allEntries.map(e => e.timestamp);
      const earliest = timestamps.length > 0 ? Math.min(...timestamps) : null;
      const latest = timestamps.length > 0 ? Math.max(...timestamps) : null;

      return {
        ...stats,
        timeRange: {
          earliest,
          latest
        }
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /**
   * GET /api/policies
   * List all access control policies
   */
  .get('/api/policies', () => {
    try {
      const policies = kms.getPolicies();
      return { policies };
    } catch (error) {
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * GET /api/policies/:id
   * Get a specific policy
   */
  .get('/api/policies/:id', ({ params, set }) => {
    try {
      const policy = kms.getPolicy(params.id);

      if (!policy) {
        set.status = 404;
        return { error: 'Policy not found' };
      }

      return policy;
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * POST /api/policies
   * Create a new custom policy
   */
  .post('/api/policies', async ({ body, set }) => {
    try {
      const policyData = body as any;

      const newPolicy = {
        id: `policy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: policyData.name,
        type: policyData.type || 'custom',
        priority: policyData.priority || 0,
        enabled: true,
        config: policyData.config,
        description: policyData.description,
        createdAt: Date.now()
      };

      await kms.addPolicy(newPolicy);
      set.status = 201;

      return newPolicy;
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * DELETE /api/policies/:id
   * Delete a custom policy
   */
  .delete('/api/policies/:id', async ({ params, set }) => {
    try {
      const removed = await kms.removePolicy(params.id);

      if (!removed) {
        set.status = 404;
        return { error: 'Policy not found or cannot be removed' };
      }

      return { success: true, message: 'Policy deleted' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * PUT /api/policies/:id/enable
   * Enable a policy
   */
  .put('/api/policies/:id/enable', async ({ params, set }) => {
    try {
      await kms.enablePolicy(params.id);
      return { success: true, message: 'Policy enabled' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * PUT /api/policies/:id/disable
   * Disable a policy
   */
  .put('/api/policies/:id/disable', async ({ params, set }) => {
    try {
      await kms.disablePolicy(params.id);
      return { success: true, message: 'Policy disabled' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // ============================================================================
  // KEY MANAGEMENT
  // ============================================================================

  /**
   * GET /api/keys/master-public
   * Get the master public key (for distribution to DataSources)
   */
  .get('/api/keys/master-public', async ({ set }) => {
    try {
      const publicKey = await kms.getMasterPublicKey();

      return {
        publicKey,
        algorithm: 'ECDH',
        curve: 'P-256',
        usage: 'Distribute this public key to DataSources for encryption',
        createdAt: kms.getStatus().keyCreatedAt
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  /**
   * GET /api/keys/status
   * Get key management system status
   */
  .get('/api/keys/status', () => {
    try {
      const status = kms.getStatus();

      return {
        masterKeyStatus: status.masterKeyStatus,
        keyAlgorithm: status.keyAlgorithm,
        keyCreatedAt: status.keyCreatedAt,
        keyRotationScheduled: null,
        secureStorage: 'enabled'
      };
    } catch (error) {
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  // ============================================================================
  // SYSTEM & STATISTICS
  // ============================================================================

  /**
   * GET /api/stats
   * Get system statistics for dashboard
   */
  .get('/api/stats', async ({ set }) => {
    try {
      const auditStats = await kms.getAuditStats();
      const allEntries = await kms.getAuditLogs();
      const policies = kms.getPolicies();

      // Calculate access request stats
      const accessRequests = allEntries.filter(e => e.eventType === 'ACCESS_REQUEST');
      const accessGranted = allEntries.filter(e => e.eventType === 'ACCESS_GRANTED');
      const accessDenied = allEntries.filter(e => e.eventType === 'ACCESS_DENIED');

      const now = Date.now();
      const last24Hours = now - (24 * 60 * 60 * 1000);
      const recentRequests = accessRequests.filter(e => e.timestamp >= last24Hours);

      // Calculate key derivation stats
      const keyGenerations = allEntries.filter(e => e.eventType === 'KEY_GENERATION');
      const totalKeys = keyGenerations.reduce((sum, e) => {
        const details = e.details as { keyCount?: number } | null;
        return sum + (details?.keyCount || 0);
      }, 0);

      const averageKeysPerRequest = keyGenerations.length > 0
        ? totalKeys / keyGenerations.length
        : 0;

      return {
        accessRequests: {
          total: accessRequests.length,
          granted: accessGranted.length,
          denied: accessDenied.length,
          last24Hours: recentRequests.length
        },
        policies: {
          total: policies.length,
          enabled: policies.filter(p => p.enabled).length,
          disabled: policies.filter(p => !p.enabled).length
        },
        auditLog: {
          totalEntries: auditStats.totalEntries,
          successRate: auditStats.successRate
        },
        keyManagement: {
          totalKeysDerivied: totalKeys,
          averageKeysPerRequest: Math.round(averageKeysPerRequest)
        }
      };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  })

  .listen(3001);

console.log(
  `🦊 ChronoCrypt KMS Backend is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:3001/`);

export type App = typeof app;
