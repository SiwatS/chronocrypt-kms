/**
 * ChronoCrypt KMS Backend API
 *
 * Elysia-based REST API for Key Management System with OpenAPI/Swagger documentation
 */

import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { KMSService } from './services/kms';
import type { AccessRequest, TimeRange } from '@siwats/chronocrypt';

// Initialize KMS Service
let kms: KMSService;

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'ChronoCrypt KMS API',
        version: '1.0.0',
        description: 'Key Management System for temporal data access control using asymmetric time-based encryption',
        contact: {
          name: 'ChronoCrypt KMS',
          url: 'https://github.com/SiwatINC/chronocrypt'
        }
      },
      tags: [
        { name: 'System', description: 'System information and health checks' },
        { name: 'Access Requests', description: 'Access request management and authorization' },
        { name: 'Audit Logs', description: 'Audit log querying and statistics' },
        { name: 'Policies', description: 'Access control policy management' },
        { name: 'Keys', description: 'Key management and distribution' },
        { name: 'Statistics', description: 'System statistics and metrics' }
      ],
      servers: [
        { url: 'http://localhost:3001', description: 'Local development' },
        { url: 'http://localhost/api', description: 'Docker with nginx' }
      ]
    }
  }))
  .onStart(async () => {
    console.log('🔐 Initializing ChronoCrypt KMS...');
    kms = await KMSService.initialize('kms-main');
    console.log('✅ KMS Service initialized');
  })

  // ============================================================================
  // SYSTEM ENDPOINTS
  // ============================================================================

  /**
   * Root endpoint - API information
   */
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
      health: '/api/health',
      swagger: '/swagger'
    }
  }), {
    detail: {
      tags: ['System'],
      summary: 'Get API information',
      description: 'Returns basic API information and available endpoints',
      responses: {
        200: {
          description: 'API information',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'ChronoCrypt KMS API' },
                  version: { type: 'string', example: '1.0.0' },
                  status: { type: 'string', example: 'running' },
                  description: { type: 'string' },
                  endpoints: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  })

  /**
   * Health check endpoint
   */
  .get('/api/health', () => ({
    status: 'healthy',
    timestamp: Date.now(),
    components: {
      keyHolder: 'operational',
      auditLog: 'operational',
      policyEngine: 'operational'
    }
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check the health status of the KMS and its components',
      responses: {
        200: {
          description: 'System health status',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'healthy' },
                  timestamp: { type: 'number', example: 1700000000000 },
                  components: {
                    type: 'object',
                    properties: {
                      keyHolder: { type: 'string', example: 'operational' },
                      auditLog: { type: 'string', example: 'operational' },
                      policyEngine: { type: 'string', example: 'operational' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

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
  }, {
    body: t.Object({
      requesterId: t.String({
        description: 'Unique identifier of the requester',
        example: 'analyst-001'
      }),
      timeRange: t.Object({
        startTime: t.Number({
          description: 'Start timestamp in milliseconds',
          example: 1700000000000
        }),
        endTime: t.Number({
          description: 'End timestamp in milliseconds',
          example: 1700003600000
        })
      }, {
        description: 'Time range for access request'
      }),
      purpose: t.Optional(t.String({
        description: 'Purpose of the access request',
        example: 'Data analysis for Q4 report'
      })),
      metadata: t.Optional(t.Record(t.String(), t.Any(), {
        description: 'Additional metadata for the request'
      }))
    }, {
      description: 'Access request payload'
    }),
    response: {
      200: t.Union([
        t.Object({
          granted: t.Literal(true, { description: 'Access granted' }),
          privateKeys: t.Record(t.String(), t.String(), {
            description: 'Base64-encoded JWK private keys indexed by timestamp'
          }),
          metadata: t.Object({
            keyCount: t.Number({ description: 'Number of keys provided' }),
            granularityMs: t.Number({ description: 'Time granularity in milliseconds' })
          })
        }, {
          description: 'Access granted response'
        }),
        t.Object({
          granted: t.Literal(false, { description: 'Access denied' }),
          denialReason: t.Optional(t.String({ description: 'Reason for denial' }))
        }, {
          description: 'Access denied response'
        })
      ]),
      400: t.Object({
        error: t.String(),
        message: t.String()
      }, { description: 'Bad request' }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      }, { description: 'Internal server error' })
    },
    detail: {
      tags: ['Access Requests'],
      summary: 'Submit access request',
      description: 'Submit a new access request for temporal data. The system will evaluate the request against active policies and return time-specific private keys if access is granted.'
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
  }, {
    query: t.Object({
      requesterId: t.Optional(t.String({ description: 'Filter by requester ID' })),
      startTime: t.Optional(t.String({ description: 'Start of time range filter' })),
      endTime: t.Optional(t.String({ description: 'End of time range filter' })),
      status: t.Optional(t.Union([
        t.Literal('granted'),
        t.Literal('denied'),
        t.Literal('all')
      ], { description: 'Filter by access status' })),
      limit: t.Optional(t.String({ description: 'Maximum results', default: '50' })),
      offset: t.Optional(t.String({ description: 'Pagination offset', default: '0' }))
    }),
    response: {
      200: t.Object({
        requests: t.Array(t.Object({
          id: t.String({ description: 'Request ID' }),
          timestamp: t.Number({ description: 'Request timestamp' }),
          requesterId: t.String({ description: 'Requester identifier' }),
          timeRange: t.Optional(t.Any()),
          purpose: t.Optional(t.String({ description: 'Request purpose' })),
          status: t.String({ description: 'Request status' })
        })),
        total: t.Number({ description: 'Total number of requests' }),
        limit: t.Number({ description: 'Results limit' }),
        offset: t.Number({ description: 'Results offset' })
      }, { description: 'Access requests list' }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Access Requests'],
      summary: 'List access requests',
      description: 'Query access requests from audit logs with optional filtering by requester, time range, and status'
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
  }, {
    query: t.Object({
      eventType: t.Optional(t.String({
        description: 'Filter by event type (ACCESS_REQUEST, ACCESS_GRANTED, ACCESS_DENIED, KEY_GENERATION, etc.)'
      })),
      actor: t.Optional(t.String({ description: 'Filter by actor' })),
      startTime: t.Optional(t.String({ description: 'Start of time range filter' })),
      endTime: t.Optional(t.String({ description: 'End of time range filter' })),
      success: t.Optional(t.String({ description: 'Filter by success status (true/false)' })),
      limit: t.Optional(t.String({ description: 'Maximum results', default: '100' })),
      offset: t.Optional(t.String({ description: 'Pagination offset', default: '0' }))
    }),
    response: {
      200: t.Object({
        entries: t.Array(t.Any(), { description: 'Audit log entries' }),
        total: t.Number({ description: 'Total number of entries' }),
        limit: t.Number({ description: 'Results limit' }),
        offset: t.Number({ description: 'Results offset' })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Audit Logs'],
      summary: 'Query audit logs',
      description: 'Query audit logs with filtering by event type, actor, time range, and success status. Supports pagination.'
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
  }, {
    response: {
      200: t.Object({
        totalEntries: t.Number({ description: 'Total audit log entries' }),
        entriesByType: t.Record(t.String(), t.Number(), { description: 'Entries grouped by event type' }),
        entriesByActor: t.Optional(t.Record(t.String(), t.Number(), { description: 'Entries grouped by actor' })),
        successRate: t.Number({ description: 'Success rate as decimal (0-1)' }),
        timeRange: t.Object({
          earliest: t.Union([t.Number(), t.Null()], { description: 'Earliest log timestamp' }),
          latest: t.Union([t.Number(), t.Null()], { description: 'Latest log timestamp' })
        })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Audit Logs'],
      summary: 'Get audit log statistics',
      description: 'Get comprehensive statistics about audit logs including entry counts by type and actor, success rate, and time range'
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
  }, {
    response: {
      200: t.Object({
        policies: t.Array(t.Any(), { description: 'List of all policies' })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'List all policies',
      description: 'Get a list of all access control policies including both built-in and custom policies'
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
  }, {
    params: t.Object({
      id: t.String({ description: 'Policy ID' })
    }),
    response: {
      200: t.Any({ description: 'Policy details' }),
      404: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'Get policy by ID',
      description: 'Retrieve details of a specific policy by its ID'
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
  }, {
    body: t.Object({
      name: t.String({ description: 'Policy name', example: 'Time-Based Restriction' }),
      type: t.Optional(t.String({ description: 'Policy type', example: 'time-based', default: 'custom' })),
      priority: t.Optional(t.Number({ description: 'Policy priority (higher = evaluated first)', default: 0 })),
      config: t.Optional(t.Any({ description: 'Policy-specific configuration' })),
      description: t.Optional(t.String({ description: 'Human-readable policy description' }))
    }),
    response: {
      201: t.Object({
        id: t.String({ description: 'Generated policy ID' }),
        name: t.String(),
        type: t.String(),
        priority: t.Number(),
        enabled: t.Boolean(),
        config: t.Optional(t.Any()),
        description: t.Optional(t.String()),
        createdAt: t.Number()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'Create policy',
      description: 'Create a new custom access control policy. The policy will be enabled by default and assigned a unique ID.'
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
  }, {
    params: t.Object({
      id: t.String({ description: 'Policy ID to delete' })
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      }),
      404: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'Delete policy',
      description: 'Delete a custom policy. Built-in policies cannot be deleted.'
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
  }, {
    params: t.Object({
      id: t.String({ description: 'Policy ID to enable' })
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'Enable policy',
      description: 'Enable a policy to make it active in access control evaluations'
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
  }, {
    params: t.Object({
      id: t.String({ description: 'Policy ID to disable' })
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Policies'],
      summary: 'Disable policy',
      description: 'Disable a policy to exclude it from access control evaluations'
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
  }, {
    response: {
      200: t.Object({
        publicKey: t.Any({ description: 'Master public key in JWK format' }),
        algorithm: t.String({ description: 'Key algorithm' }),
        curve: t.String({ description: 'Elliptic curve name' }),
        usage: t.String({ description: 'Public key usage description' }),
        createdAt: t.Number({ description: 'Key creation timestamp' })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Keys'],
      summary: 'Get master public key',
      description: 'Retrieve the master public key for distribution to DataSources. DataSources use this key to encrypt temporal data.'
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
  }, {
    response: {
      200: t.Object({
        masterKeyStatus: t.String({ description: 'Master key status' }),
        keyAlgorithm: t.String({ description: 'Key algorithm' }),
        keyCreatedAt: t.Number({ description: 'Key creation timestamp' }),
        keyRotationScheduled: t.Union([t.Number(), t.Null()], { description: 'Scheduled key rotation timestamp' }),
        secureStorage: t.String({ description: 'Secure storage status' })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Keys'],
      summary: 'Get key status',
      description: 'Get the current status of the key management system including master key information and rotation schedule'
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
  }, {
    response: {
      200: t.Object({
        accessRequests: t.Object({
          total: t.Number({ description: 'Total access requests' }),
          granted: t.Number({ description: 'Granted requests' }),
          denied: t.Number({ description: 'Denied requests' }),
          last24Hours: t.Number({ description: 'Requests in last 24 hours' })
        }),
        policies: t.Object({
          total: t.Number({ description: 'Total policies' }),
          enabled: t.Number({ description: 'Enabled policies' }),
          disabled: t.Number({ description: 'Disabled policies' })
        }),
        auditLog: t.Object({
          totalEntries: t.Number({ description: 'Total audit log entries' }),
          successRate: t.Number({ description: 'Success rate (0-1)' })
        }),
        keyManagement: t.Object({
          totalKeysDerivied: t.Number({ description: 'Total derived keys' }),
          averageKeysPerRequest: t.Number({ description: 'Average keys per request' })
        })
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Statistics'],
      summary: 'Get system statistics',
      description: 'Get comprehensive system statistics including access requests, policies, audit logs, and key management metrics for the dashboard'
    }
  })

  .listen(3001);

console.log(
  `🦊 ChronoCrypt KMS Backend is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 Swagger UI: http://localhost:3001/swagger`);
console.log(`📖 API Documentation: http://localhost:3001/`);
