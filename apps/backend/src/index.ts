/**
 * ChronoCrypt KMS Backend API
 *
 * Elysia-based REST API for Key Management System with OpenAPI/Swagger documentation and authentication
 */

import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { cookie } from '@elysiajs/cookie';
import { KMSService } from './services/kms';
import type { AccessRequest, TimeRange } from '@siwats/chronocrypt';

// Initialize KMS Service
let kms: KMSService;

// Session management
const sessions = new Map<string, { username: string; createdAt: number }>();

// Generate session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Clean up expired sessions (older than 24 hours)
function cleanupSessions() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

// Authentication credentials from environment
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'chronocrypt-admin-change-me';

// Authentication middleware
function requireAuth({ cookie: cookies, set }: any) {
  const sessionId = cookies.sessionId;

  if (!sessionId || !sessions.has(sessionId)) {
    set.status = 401;
    return {
      error: 'Unauthorized',
      message: 'Authentication required'
    };
  }

  // Update session last access
  const session = sessions.get(sessionId);
  if (session) {
    session.createdAt = Date.now(); // Refresh session
  }
}

const app = new Elysia()
  .use(cors({
    credentials: true,
    origin: (request) => {
      const origin = request.headers.get('origin');
      // Allow localhost for development
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return true;
      }
      return false;
    }
  }))
  .use(cookie())
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
        { name: 'Authentication', description: 'Authentication and session management' },
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
    console.log(`👤 Admin user: ${ADMIN_USERNAME}`);
    if (ADMIN_PASSWORD === 'chronocrypt-admin-change-me') {
      console.warn('⚠️  WARNING: Using default admin password! Set ADMIN_PASSWORD environment variable.');
    }
  })

  // ============================================================================
  // AUTHENTICATION ENDPOINTS (Public)
  // ============================================================================

  /**
   * POST /api/auth/login
   * Login with username and password
   */
  .post('/api/auth/login', async ({ body, cookie: cookies, set }) => {
    try {
      const { username, password } = body as { username: string; password: string };

      // Validate credentials
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Create session
        const sessionId = generateSessionId();
        sessions.set(sessionId, {
          username,
          createdAt: Date.now()
        });

        // Set cookie
        cookies.sessionId = {
          value: sessionId,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60, // 24 hours in seconds
          path: '/'
        };

        return {
          success: true,
          message: 'Login successful',
          user: { username }
        };
      }

      // Invalid credentials
      set.status = 401;
      return {
        success: false,
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
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
      username: t.String({ description: 'Username', example: 'admin' }),
      password: t.String({ description: 'Password' })
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        user: t.Object({
          username: t.String()
        })
      }),
      401: t.Object({
        success: t.Boolean(),
        error: t.String(),
        message: t.String()
      }),
      500: t.Object({
        error: t.String(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Authentication'],
      summary: 'Login',
      description: 'Authenticate with username and password. Returns a session cookie on success.'
    }
  })

  /**
   * POST /api/auth/logout
   * Logout and destroy session
   */
  .post('/api/auth/logout', ({ cookie: cookies }) => {
    const sessionId = cookies.sessionId;

    if (sessionId) {
      sessions.delete(sessionId);
      cookies.sessionId = {
        value: '',
        maxAge: 0
      };
    }

    return {
      success: true,
      message: 'Logged out successfully'
    };
  }, {
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Authentication'],
      summary: 'Logout',
      description: 'Logout and destroy the current session'
    }
  })

  /**
   * GET /api/auth/session
   * Check current session status
   */
  .get('/api/auth/session', ({ cookie: cookies, set }) => {
    const sessionId = cookies.sessionId;

    if (!sessionId || !sessions.has(sessionId)) {
      set.status = 401;
      return {
        authenticated: false,
        message: 'No active session'
      };
    }

    const session = sessions.get(sessionId);
    return {
      authenticated: true,
      user: {
        username: session!.username
      }
    };
  }, {
    response: {
      200: t.Object({
        authenticated: t.Boolean(),
        user: t.Optional(t.Object({
          username: t.String()
        }))
      }),
      401: t.Object({
        authenticated: t.Boolean(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Authentication'],
      summary: 'Check session',
      description: 'Check if the current session is valid and authenticated'
    }
  })

  /**
   * GET /api/auth/setup-required
   * Check if initial setup is required
   */
  .get('/api/auth/setup-required', () => {
    // If using default password, setup is required
    const setupRequired = ADMIN_PASSWORD === 'chronocrypt-admin-change-me';

    return {
      setupRequired,
      message: setupRequired
        ? 'Initial setup required. Please set ADMIN_PASSWORD environment variable.'
        : 'Setup complete'
    };
  }, {
    response: {
      200: t.Object({
        setupRequired: t.Boolean(),
        message: t.String()
      })
    },
    detail: {
      tags: ['Authentication'],
      summary: 'Check setup status',
      description: 'Check if initial setup is required (default password check)'
    }
  })

  // ============================================================================
  // SYSTEM ENDPOINTS (Public)
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
      auth: '/api/auth/login',
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
    }
  })

  /**
   * Health check endpoint (Public)
   */
  .get('/api/health', () => ({
    status: 'healthy',
    timestamp: Date.now(),
    components: {
      keyHolder: 'operational',
      auditLog: 'operational',
      policyEngine: 'operational',
      authentication: sessions.size > 0 ? 'active' : 'idle'
    }
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check the health status of the KMS and its components',
    }
  })

  // ============================================================================
  // PROTECTED ROUTES - Require Authentication
  // ============================================================================

  .guard({
    beforeHandle: requireAuth
  }, (app) => app

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
      detail: {
        tags: ['Access Requests'],
        summary: 'Submit access request',
        description: 'Submit a new access request for temporal data. The system will evaluate the request against active policies and return time-specific private keys if access is granted. **Requires authentication.**'
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
      detail: {
        tags: ['Access Requests'],
        summary: 'List access requests',
        description: 'Query access requests from audit logs with optional filtering by requester, time range, and status. **Requires authentication.**'
      }
    })

    // ============================================================================
    // AUDIT LOG MANAGEMENT
    // ============================================================================

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

        // Apply filters
        if (eventType) entries = entries.filter(e => e.eventType === eventType);
        if (actor) entries = entries.filter(e => e.actor === actor);
        if (startTime && endTime) {
          const start = parseInt(startTime);
          const end = parseInt(endTime);
          entries = entries.filter(e => e.timestamp >= start && e.timestamp <= end);
        }
        if (success !== undefined) {
          const successBool = success === 'true';
          entries = entries.filter(e => e.success === successBool);
        }

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
      detail: {
        tags: ['Audit Logs'],
        summary: 'Query audit logs',
        description: 'Query audit logs with filtering by event type, actor, time range, and success status. **Requires authentication.**'
      }
    })

    .get('/api/audit-logs/stats', async ({ set }) => {
      try {
        const stats = await kms.getAuditStats();
        const allEntries = await kms.getAuditLogs();

        const timestamps = allEntries.map(e => e.timestamp);
        const earliest = timestamps.length > 0 ? Math.min(...timestamps) : null;
        const latest = timestamps.length > 0 ? Math.max(...timestamps) : null;

        return {
          ...stats,
          timeRange: { earliest, latest }
        };
      } catch (error) {
        set.status = 500;
        return {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }, {
      detail: {
        tags: ['Audit Logs'],
        summary: 'Get audit log statistics',
        description: 'Get comprehensive statistics about audit logs. **Requires authentication.**'
      }
    })

    // ============================================================================
    // POLICY MANAGEMENT
    // ============================================================================

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
      detail: {
        tags: ['Policies'],
        summary: 'List all policies',
        description: 'Get a list of all access control policies. **Requires authentication.**'
      }
    })

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
      detail: {
        tags: ['Policies'],
        summary: 'Get policy by ID',
        description: 'Retrieve details of a specific policy. **Requires authentication.**'
      }
    })

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
        priority: t.Optional(t.Number({ description: 'Policy priority', default: 0 })),
        config: t.Optional(t.Any()),
        description: t.Optional(t.String())
      }),
      detail: {
        tags: ['Policies'],
        summary: 'Create policy',
        description: 'Create a new custom access control policy. **Requires authentication.**'
      }
    })

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
      detail: {
        tags: ['Policies'],
        summary: 'Delete policy',
        description: 'Delete a custom policy. **Requires authentication.**'
      }
    })

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
      detail: {
        tags: ['Policies'],
        summary: 'Enable policy',
        description: 'Enable a policy. **Requires authentication.**'
      }
    })

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
      detail: {
        tags: ['Policies'],
        summary: 'Disable policy',
        description: 'Disable a policy. **Requires authentication.**'
      }
    })

    // ============================================================================
    // KEY MANAGEMENT
    // ============================================================================

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
      detail: {
        tags: ['Keys'],
        summary: 'Get master public key',
        description: 'Retrieve the master public key for distribution to DataSources. **Requires authentication.**'
      }
    })

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
      detail: {
        tags: ['Keys'],
        summary: 'Get key status',
        description: 'Get the current status of the key management system. **Requires authentication.**'
      }
    })

    // ============================================================================
    // SYSTEM & STATISTICS
    // ============================================================================

    .get('/api/stats', async ({ set }) => {
      try {
        const auditStats = await kms.getAuditStats();
        const allEntries = await kms.getAuditLogs();
        const policies = kms.getPolicies();

        const accessRequests = allEntries.filter(e => e.eventType === 'ACCESS_REQUEST');
        const accessGranted = allEntries.filter(e => e.eventType === 'ACCESS_GRANTED');
        const accessDenied = allEntries.filter(e => e.eventType === 'ACCESS_DENIED');

        const now = Date.now();
        const last24Hours = now - (24 * 60 * 60 * 1000);
        const recentRequests = accessRequests.filter(e => e.timestamp >= last24Hours);

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
      detail: {
        tags: ['Statistics'],
        summary: 'Get system statistics',
        description: 'Get comprehensive system statistics for the dashboard. **Requires authentication.**'
      }
    })

  ) // End of protected routes guard

  .listen(3001);

console.log(
  `🦊 ChronoCrypt KMS Backend is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 Swagger UI: http://localhost:3001/swagger`);
console.log(`🔐 Authentication enabled - Admin user: ${ADMIN_USERNAME}`);
console.log(`📖 API Documentation: http://localhost:3001/`);
