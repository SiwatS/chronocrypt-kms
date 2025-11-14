/**
 * KMS Service - Wrapper around ChronoCrypt KeyHolder
 *
 * This service manages the ChronoCrypt Key Holder instance and provides
 * a simplified interface for the API layer.
 */

import {
  generateMasterKeypair,
  exportPublicKey,
  createKeyHolder,
  InMemoryAuditLog,
  createAllowAllPolicy,
  type MasterKeypair,
  type ExportedPublicKey,
  type AccessRequest,
  type AccessResponse,
  type AuditLogEntry,
  type TimeRange,
  type AccessControlPolicy,
  type KeyHolder
} from '@siwats/chronocrypt';

/**
 * Policy configuration for custom policies
 */
export interface PolicyConfig {
  id: string;
  name: string;
  type: 'whitelist' | 'time-based' | 'duration-limit' | 'custom';
  priority?: number;
  enabled: boolean;
  config?: Record<string, unknown>;
  description?: string;
}

/**
 * KMS Service class
 */
export class KMSService {
  private keyHolder: KeyHolder;
  private masterKeypair: MasterKeypair;
  private auditLog: InMemoryAuditLog;
  private policies: Map<string, PolicyConfig>;
  private keyHolderId: string;
  private createdAt: number;

  private constructor(
    keyHolder: KeyHolder,
    masterKeypair: MasterKeypair,
    auditLog: InMemoryAuditLog,
    keyHolderId: string
  ) {
    this.keyHolder = keyHolder;
    this.masterKeypair = masterKeypair;
    this.auditLog = auditLog;
    this.keyHolderId = keyHolderId;
    this.createdAt = Date.now();
    this.policies = new Map();

    // Add default allow-all policy
    this.policies.set('allow-all', {
      id: 'allow-all',
      name: 'Allow All',
      type: 'custom',
      priority: -1000,
      enabled: true,
      description: 'Allows all access requests (for development)'
    });
  }

  /**
   * Initialize a new KMS instance
   */
  static async initialize(keyHolderId: string = 'kms-main'): Promise<KMSService> {
    console.log(`Initializing KMS Service: ${keyHolderId}`);

    // Generate master keypair
    const masterKeypair = await generateMasterKeypair();
    console.log('Master keypair generated');

    // Create audit log
    const auditLog = new InMemoryAuditLog();

    // Create key holder with default policy
    const policies = [createAllowAllPolicy()];
    const keyHolder = createKeyHolder(masterKeypair, auditLog, policies, keyHolderId);

    console.log('KeyHolder created with default policy');

    return new KMSService(keyHolder, masterKeypair, auditLog, keyHolderId);
  }

  /**
   * Process an access request
   */
  async authorizeAccess(request: AccessRequest): Promise<AccessResponse> {
    return await this.keyHolder.authorizeAccess(request);
  }

  /**
   * Get master public key (for distribution)
   */
  async getMasterPublicKey(): Promise<ExportedPublicKey> {
    return await exportPublicKey(this.masterKeypair.publicKey);
  }

  /**
   * Get audit log entries
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
  getPolicies(): PolicyConfig[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy
   */
  getPolicy(id: string): PolicyConfig | undefined {
    return this.policies.get(id);
  }

  /**
   * Add or update a policy
   */
  async addPolicy(policy: PolicyConfig): Promise<void> {
    this.policies.set(policy.id, policy);
    // In a real implementation, we would rebuild the KeyHolder with updated policies
    console.log(`Policy added: ${policy.name} (${policy.id})`);
  }

  /**
   * Remove a policy
   */
  async removePolicy(id: string): Promise<boolean> {
    if (id === 'allow-all') {
      throw new Error('Cannot remove built-in allow-all policy');
    }
    return this.policies.delete(id);
  }

  /**
   * Enable a policy
   */
  async enablePolicy(id: string): Promise<void> {
    const policy = this.policies.get(id);
    if (policy) {
      policy.enabled = true;
    }
  }

  /**
   * Disable a policy
   */
  async disablePolicy(id: string): Promise<void> {
    const policy = this.policies.get(id);
    if (policy) {
      policy.enabled = false;
    }
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
      auditLogSize: this.auditLog.size(),
      policiesCount: this.policies.size
    };
  }
}
