/**
 * ChronoCrypt KMS Backend API
 *
 * Elysia-based REST API for Key Management System with OpenAPI/Swagger documentation and authentication
 */

import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { PrismaClient, Prisma } from '@prisma/client';
import { KMSService, type PolicyConfig } from './services/kms';
import { createApiKeyMiddleware, generateApiKeyPair, hashApiKeySecret } from './auth/api-keys';
import {
  authenticateAdmin,
  createSession,
  validateSession,
  deleteSession,
  createAdminMiddleware,
  hashPassword
} from './auth/admin';
import type { AccessRequest, TimeRange } from '@siwats/chronocrypt';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize KMS Service
let kms: KMSService;

// Authentication Middlewares
const requireApiKey = createApiKeyMiddleware(prisma);
const requireAdmin = createAdminMiddleware(prisma);

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
        { name: 'Requesters', description: 'Requester management' },
        { name: 'API Keys', description: 'API key management and authentication' },
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
    console.log('🔑 API Key authentication enabled');
    console.log('📊 Prisma Client connected');
  })

  // ============================================================================
  // SYSTEM ENDPOINTS (Public)
  // ============================================================================

  /**
   * Root endpoint - API information
   */
  .get('/', () => ({
    name: 'ChronoCrypt KMS API',
    version: '2.0.0',
    status: 'running',
    description: 'Key Management System for temporal data access control with API key authentication',
    authentication: 'API Key (Authorization: ApiKey <keyId>.<keySecret>)',
    endpoints: {
      requesters: '/api/requesters',
      apiKeys: '/api/api-keys',
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
  .get('/api/health', async () => ({
    status: 'healthy',
    timestamp: Date.now(),
    components: {
      keyHolder: 'operational',
      auditLog: 'operational',
      policyEngine: 'operational',
      database: 'operational',
      authentication: 'api-key'
    }
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check the health status of the KMS and its components',
    }
  })

  // ============================================================================
  // ADMIN AUTHENTICATION (for Web UI)
  // ============================================================================

  /**
   * POST /api/admin/setup
   * Create initial admin account (only works if no admins exist)
   */
  .post('/api/admin/setup', async ({ body, set }) => {
    try {
      const { username, password, email } = body as {
        username: string;
        password: string;
        email?: string;
      };

      // Check if any admins already exist
      const existingAdminCount = await prisma.admin.count();
      if (existingAdminCount > 0) {
        set.status = 403;
        return {
          error: 'Forbidden',
          message: 'Admin accounts already exist. Use the admin panel to create new admins.'
        };
      }

      const passwordHash = await hashPassword(password);
      const admin = await prisma.admin.create({
        data: {
          username,
          passwordHash,
          email,
          enabled: true
        }
      });

      return {
        message: 'Initial admin account created successfully',
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email
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
    body: t.Object({
      username: t.String({ minLength: 3, description: 'Admin username', example: 'admin' }),
      password: t.String({ minLength: 8, description: 'Admin password' }),
      email: t.Optional(t.String({ format: 'email', description: 'Admin email' }))
    }),
    detail: {
      tags: ['Admin'],
      summary: 'Setup initial admin',
      description: 'Create the first admin account. Only works if no admins exist yet.',
    }
  })

  /**
   * POST /api/admin/login
   * Admin login - returns session token
   */
  .post('/api/admin/login', async ({ body, set }) => {
    try {
      const { username, password } = body as {
        username: string;
        password: string;
      };

      const admin = await authenticateAdmin(prisma, username, password);
      if (!admin) {
        set.status = 401;
        return {
          error: 'Unauthorized',
          message: 'Invalid username or password'
        };
      }

      const sessionId = createSession(admin.adminId, admin.username);

      return {
        sessionId,
        admin: {
          username: admin.username
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
    body: t.Object({
      username: t.String({ description: 'Admin username' }),
      password: t.String({ description: 'Admin password' })
    }),
    detail: {
      tags: ['Admin'],
      summary: 'Admin login',
      description: 'Authenticate admin and receive session token',
    }
  })

  /**
   * POST /api/admin/logout
   * Admin logout - destroys session
   */
  .post('/api/admin/logout', async ({ headers, set }) => {
    try {
      const sessionId = headers['authorization']?.replace('Bearer ', '');
      if (sessionId) {
        deleteSession(sessionId);
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'Admin logout',
      description: 'Destroy admin session',
    }
  })

  /**
   * GET /api/admin/session
   * Check session validity
   */
  .get('/api/admin/session', async ({ headers, set }) => {
    try {
      const sessionId = headers['authorization']?.replace('Bearer ', '');
      if (!sessionId) {
        set.status = 401;
        return { valid: false, error: 'No session provided' };
      }

      const session = validateSession(sessionId);
      if (!session) {
        set.status = 401;
        return { valid: false, error: 'Invalid or expired session' };
      }

      return {
        valid: true,
        admin: {
          username: session.username
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
      tags: ['Admin'],
      summary: 'Check session',
      description: 'Validate current admin session',
    }
  })

  // ============================================================================
  // REQUESTER MANAGEMENT (Admin-protected)
  // ============================================================================

  .guard({ beforeHandle: requireAdmin }, (app) => app
  /**
   * GET /api/requesters
   * List all requesters
   */
  .get('/api/requesters', async ({ set }) => {
    try {
      const requesters = await prisma.requester.findMany({
        include: {
          apiKeys: {
            select: {
              id: true,
              keyId: true,
              name: true,
              enabled: true,
              expiresAt: true,
              lastUsedAt: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { requesters };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['Requesters'],
      summary: 'List requesters',
      description: 'Get all requesters with their API keys (secrets not included)'
    }
  })

  /**
   * POST /api/requesters
   * Create a new requester
   */
  .post('/api/requesters', async ({ body, set }) => {
    try {
      const { name, description, metadata } = body as {
        name: string;
        description?: string;
        metadata?: unknown;
      };

      const requester = await prisma.requester.create({
        data: { name, description, metadata }
      });

      set.status = 201;
      return requester;
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    body: t.Object({
      name: t.String({ description: 'Requester name', example: 'Analytics Team' }),
      description: t.Optional(t.String({ description: 'Description', example: 'Data analytics team' })),
      metadata: t.Optional(t.Any({ description: 'Additional metadata' }))
    }),
    detail: {
      tags: ['Requesters'],
      summary: 'Create requester',
      description: 'Create a new requester who can request access to encrypted data'
    }
  })

  /**
   * PUT /api/requesters/:id
   * Update a requester
   */
  .put('/api/requesters/:id', async ({ params, body, set }) => {
    try {
      const { name, description, enabled, metadata } = body as {
        name?: string;
        description?: string;
        enabled?: boolean;
        metadata?: unknown;
      };

      const requester = await prisma.requester.update({
        where: { id: params.id },
        data: { name, description, enabled, metadata }
      });

      return requester;
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['Requesters'],
      summary: 'Update requester',
      description: 'Update requester information'
    }
  })

  /**
   * DELETE /api/requesters/:id
   * Delete a requester (cascades to API keys)
   */
  .delete('/api/requesters/:id', async ({ params, set }) => {
    try {
      await prisma.requester.delete({
        where: { id: params.id }
      });

      return { success: true, message: 'Requester deleted' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['Requesters'],
      summary: 'Delete requester',
      description: 'Delete a requester and all associated API keys'
    }
  })

  // ============================================================================
  // API KEY MANAGEMENT
  // ============================================================================

  /**
   * POST /api/requesters/:id/api-keys
   * Generate a new API key for a requester
   */
  .post('/api/requesters/:id/api-keys', async ({ params, body, set }) => {
    try {
      const { name, expiresAt } = body as {
        name: string;
        expiresAt?: string;
      };

      // Generate API key pair
      const { keyId, keySecret } = generateApiKeyPair();
      const hashedSecret = await hashApiKeySecret(keySecret);

      // Create API key in database
      const apiKey = await prisma.apiKey.create({
        data: {
          keyId,
          keySecret: hashedSecret,
          name,
          requesterId: params.id,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: 'system' // TODO: Get from auth context when admin auth is added
        }
      });

      set.status = 201;

      // Return the full API key (this is the ONLY time the secret is shown)
      return {
        apiKey: {
          id: apiKey.id,
          keyId: apiKey.keyId,
          name: apiKey.name,
          requesterId: apiKey.requesterId,
          enabled: apiKey.enabled,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt
        },
        fullApiKey: `${keyId}.${keySecret}`,
        warning: 'Save this key now! It will not be shown again.'
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
      name: t.String({ description: 'API key name', example: 'Production Server' }),
      expiresAt: t.Optional(t.String({ description: 'Expiration date (ISO 8601)', example: '2025-12-31T23:59:59Z' }))
    }),
    detail: {
      tags: ['API Keys'],
      summary: 'Generate API key',
      description: 'Generate a new API key for a requester. The secret is only shown once!'
    }
  })

  /**
   * GET /api/api-keys
   * List all API keys (no secrets)
   */
  .get('/api/api-keys', async ({ set }) => {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        include: {
          requester: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        apiKeys: apiKeys.map((key: typeof apiKeys[number]) => ({
          id: key.id,
          keyId: key.keyId,
          name: key.name,
          requester: key.requester,
          enabled: key.enabled,
          expiresAt: key.expiresAt,
          lastUsedAt: key.lastUsedAt,
          createdAt: key.createdAt,
          createdBy: key.createdBy
        }))
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
      tags: ['API Keys'],
      summary: 'List API keys',
      description: 'List all API keys (secrets are never returned after creation)'
    }
  })

  /**
   * DELETE /api/api-keys/:id
   * Revoke an API key
   */
  .delete('/api/api-keys/:id', async ({ params, set }) => {
    try {
      await prisma.apiKey.delete({
        where: { id: params.id }
      });

      return { success: true, message: 'API key revoked' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['API Keys'],
      summary: 'Revoke API key',
      description: 'Permanently revoke an API key'
    }
  })

  /**
   * PUT /api/api-keys/:id/enable
   * Enable an API key
   */
  .put('/api/api-keys/:id/enable', async ({ params, set }) => {
    try {
      await prisma.apiKey.update({
        where: { id: params.id },
        data: { enabled: true }
      });

      return { success: true, message: 'API key enabled' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['API Keys'],
      summary: 'Enable API key',
      description: 'Enable a disabled API key'
    }
  })

  /**
   * PUT /api/api-keys/:id/disable
   * Disable an API key
   */
  .put('/api/api-keys/:id/disable', async ({ params, set }) => {
    try {
      await prisma.apiKey.update({
        where: { id: params.id },
        data: { enabled: false }
      });

      return { success: true, message: 'API key disabled' };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }, {
    detail: {
      tags: ['API Keys'],
      summary: 'Disable API key',
      description: 'Temporarily disable an API key without deleting it'
    }
  })
  ) // End of admin-protected routes

  // ============================================================================
  // PROTECTED ROUTES - Require API Key Authentication
  // ============================================================================

  .guard({
    beforeHandle: requireApiKey
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
  ) // End of API key protected routes

  // ============================================================================
  // ADMIN-ONLY ROUTES (Audit Logs, Policies, Stats, Keys Status)
  // ============================================================================

  .guard({ beforeHandle: requireAdmin }, (app) => app

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
        const policyData = body as {
          name: string;
          type?: string;
          priority?: number;
          config: PolicyConfig;
          description?: string;
        };

        const newPolicy: PolicyConfig = {
          id: `policy-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: policyData.name,
          type: (policyData.type || 'custom') as PolicyConfig['type'],
          priority: policyData.priority || 0,
          enabled: true,
          config: policyData.config as Record<string, unknown> | undefined,
          description: policyData.description,
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
  ) // End of admin-only routes (temporarily)

  // ============================================================================
  // PUBLIC KEY ENDPOINT (Public - for encryption)
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
      description: 'Retrieve the master public key for distribution to DataSources. This is a public endpoint.'
    }
  })

  // ============================================================================
  // KEY STATUS (Admin-only)
  // ============================================================================

  .guard({ beforeHandle: requireAdmin }, (app) => app
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

  ) // End of admin-only routes

  .listen(3001);

// Export type for Eden Treaty client
export type App = typeof app;

console.log(
  `🦊 ChronoCrypt KMS Backend is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 Swagger UI: http://localhost:3001/swagger`);
console.log(`🔑 API Key authentication enabled`);
console.log(`📖 API Documentation: http://localhost:3001/`);
