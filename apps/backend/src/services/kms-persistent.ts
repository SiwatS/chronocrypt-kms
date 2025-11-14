/**
 * Persistent KMS Service with Prisma Integration
 *
 * This version uses PostgreSQL for persistent storage of:
 * - Audit logs
 * - Policies
 * - Access request history
 */

import {
  generateMasterKeypair,
  exportPublicKey,
  createKeyHolder,
  createAllowAllPolicy,
  type MasterKeypair,
  type ExportedPublicKey,
  type AccessRequest,
  type AccessResponse,
  type AuditLogEntry,
  type TimeRange,
  type KeyHolder,
  type AuditLogStorage,
} from '@siwats/chronocrypt';

import { PrismaAuditLog } from '../storage/prisma-audit-log';
import { PrismaPolicyStore } from '../storage/prisma-policy-store';
import { PrismaAccessRequestStore } from '../storage/prisma-access-request-store';
import type { PolicyConfig } from './kms';

export interface KMSPersistentConfig {
  keyHolderId?: string;
  usePersistence?: boolean;
}

/**
 * Persistent KMS Service with database storage
 */
export class KMSPersistentService {
  private keyHolder: KeyHolder;
  private masterKeypair: MasterKeypair;
  private auditLog: PrismaAuditLog;
  private policyStore: PrismaPolicyStore;
  private accessRequestStore: PrismaAccessRequestStore;
  private keyHolderId: string;
  private createdAt: number;

  private constructor(
    keyHolder: KeyHolder,
    masterKeypair: MasterKeypair,
    auditLog: PrismaAuditLog,
    policyStore: PrismaPolicyStore,
    accessRequestStore: PrismaAccessRequestStore,
    keyHolderId: string
  ) {
    this.keyHolder = keyHolder;
    this.masterKeypair = masterKeypair;
    this.auditLog = auditLog;
    this.policyStore = policyStore;
    this.accessRequestStore = accessRequestStore;
    this.keyHolderId = keyHolderId;
    this.createdAt = Date.now();
  }

  /**
   * Initialize a new persistent KMS instance
   */
  static async initialize(config: KMSPersistentConfig = {}): Promise<KMSPersistentService> {
    const keyHolderId = config.keyHolderId || 'kms-main';
    console.log(`Initializing Persistent KMS Service: ${keyHolderId}`);

    // Initialize stores
    const auditLog = new PrismaAuditLog();
    const policyStore = new PrismaPolicyStore();
    const accessRequestStore = new PrismaAccessRequestStore();

    // Initialize default policies if needed
    await policyStore.initializeDefaults();

    // Load enabled policies
    const enabledPolicies = await policyStore.getEnabled();
    console.log(`Loaded ${enabledPolicies.length} enabled policies from database`);

    // Generate or load master keypair
    // TODO: In production, load from encrypted storage
    const masterKeypair = await generateMasterKeypair();
    console.log('Master keypair generated');

    // Create access control policies for ChronoCrypt
    const policies = [createAllowAllPolicy()];

    // Create key holder
    const keyHolder = createKeyHolder(
      masterKeypair,
      auditLog as unknown as AuditLogStorage,
      policies,
      keyHolderId
    );

    console.log('KeyHolder created with persistent storage');

    return new KMSPersistentService(
      keyHolder,
      masterKeypair,
      auditLog,
      policyStore,
      accessRequestStore,
      keyHolderId
    );
  }

  /**
   * Process an access request with persistent tracking
   */
  async authorizeAccess(request: AccessRequest): Promise<AccessResponse> {
    // Process the request
    const response = await this.keyHolder.authorizeAccess(request);

    // Store request history
    try {
      await this.accessRequestStore.save(request, response);
    } catch (error) {
      console.error('Failed to save access request history:', error);
      // Don't fail the request if history storage fails
    }

    return response;
  }

  /**
   * Get master public key
   */
  async getMasterPublicKey(): Promise<ExportedPublicKey> {
    return await exportPublicKey(this.masterKeypair.publicKey);
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(options?: {
    timeRange?: TimeRange;
    eventType?: AuditLogEntry['eventType'];
    actor?: string;
  }): Promise<AuditLogEntry[]> {
    if (options?.timeRange) {
      return await this.auditLog.retrieve(options.timeRange);
    }

    if (options?.eventType) {
      return await this.auditLog.retrieveByEventType(options.eventType);
    }

    if (options?.actor) {
      return await this.auditLog.retrieveByActor(options.actor);
    }

    return await this.auditLog.getAll();
  }

  /**
   * Get audit log statistics
   */
  async getAuditStats() {
    return await this.auditLog.getStatistics();
  }

  /**
   * Get all policies
   */
  async getPolicies(): Promise<PolicyConfig[]> {
    return await this.policyStore.getAll();
  }

  /**
   * Get a specific policy
   */
  async getPolicy(id: string): Promise<PolicyConfig | undefined> {
    const policy = await this.policyStore.getById(id);
    return policy || undefined;
  }

  /**
   * Add or update a policy
   */
  async addPolicy(policy: PolicyConfig): Promise<void> {
    await this.policyStore.upsert(policy);
    console.log(`Policy saved to database: ${policy.name} (${policy.id})`);
  }

  /**
   * Remove a policy
   */
  async removePolicy(id: string): Promise<boolean> {
    if (id === 'allow-all') {
      throw new Error('Cannot remove built-in allow-all policy');
    }
    return await this.policyStore.delete(id);
  }

  /**
   * Enable a policy
   */
  async enablePolicy(id: string): Promise<void> {
    await this.policyStore.enable(id);
  }

  /**
   * Disable a policy
   */
  async disablePolicy(id: string): Promise<void> {
    await this.policyStore.disable(id);
  }

  /**
   * Get access request history
   */
  async getAccessRequests(options?: {
    requesterId?: string;
    startTime?: number;
    endTime?: number;
    granted?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return await this.accessRequestStore.getRequests(options);
  }

  /**
   * Get access request statistics
   */
  async getAccessRequestStats() {
    return await this.accessRequestStore.getStatistics();
  }

  /**
   * Get KMS status
   */
  getStatus() {
    return {
      keyHolderId: this.keyHolderId,
      masterKeyStatus: 'active',
      keyAlgorithm: 'EC P-256',
      keyCreatedAt: this.createdAt,
      persistence: 'enabled',
      storage: 'postgresql',
    };
  }
}
