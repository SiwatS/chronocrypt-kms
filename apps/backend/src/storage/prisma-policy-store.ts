/**
 * Prisma-based Policy Storage
 *
 * Persistent policy storage using PostgreSQL
 */

import { prisma } from '../lib/prisma';
import type { PolicyConfig } from '../services/kms';

export class PrismaPolicyStore {
  /**
   * Get all policies
   */
  async getAll(): Promise<PolicyConfig[]> {
    const policies = await prisma.policy.findMany({
      orderBy: {
        priority: 'desc',
      },
    });

    return policies.map(this.toPolicyConfig);
  }

  /**
   * Get policy by ID
   */
  async getById(id: string): Promise<PolicyConfig | null> {
    const policy = await prisma.policy.findUnique({
      where: { id },
    });

    return policy ? this.toPolicyConfig(policy) : null;
  }

  /**
   * Create or update a policy
   */
  async upsert(policy: PolicyConfig): Promise<PolicyConfig> {
    const upserted = await prisma.policy.upsert({
      where: { id: policy.id },
      create: {
        id: policy.id,
        name: policy.name,
        type: policy.type,
        priority: policy.priority || 0,
        enabled: policy.enabled,
        config: policy.config as any,
        description: policy.description,
      },
      update: {
        name: policy.name,
        type: policy.type,
        priority: policy.priority || 0,
        enabled: policy.enabled,
        config: policy.config as any,
        description: policy.description,
      },
    });

    return this.toPolicyConfig(upserted);
  }

  /**
   * Delete a policy
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.policy.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable a policy
   */
  async enable(id: string): Promise<void> {
    await prisma.policy.update({
      where: { id },
      data: { enabled: true },
    });
  }

  /**
   * Disable a policy
   */
  async disable(id: string): Promise<void> {
    await prisma.policy.update({
      where: { id },
      data: { enabled: false },
    });
  }

  /**
   * Get enabled policies
   */
  async getEnabled(): Promise<PolicyConfig[]> {
    const policies = await prisma.policy.findMany({
      where: { enabled: true },
      orderBy: {
        priority: 'desc',
      },
    });

    return policies.map(this.toPolicyConfig);
  }

  /**
   * Count policies
   */
  async count(): Promise<number> {
    return await prisma.policy.count();
  }

  /**
   * Count enabled policies
   */
  async countEnabled(): Promise<number> {
    return await prisma.policy.count({
      where: { enabled: true },
    });
  }

  /**
   * Initialize default policies
   */
  async initializeDefaults(): Promise<void> {
    const existingCount = await this.count();

    if (existingCount === 0) {
      // Create default allow-all policy
      await this.upsert({
        id: 'allow-all',
        name: 'Allow All',
        type: 'custom',
        priority: -1000,
        enabled: true,
        description: 'Allows all access requests (for development)',
      });
    }
  }

  /**
   * Convert Prisma model to PolicyConfig
   */
  private toPolicyConfig(policy: any): PolicyConfig {
    return {
      id: policy.id,
      name: policy.name,
      type: policy.type,
      priority: policy.priority,
      enabled: policy.enabled,
      config: policy.config as Record<string, unknown> | undefined,
      description: policy.description || undefined,
    };
  }
}
