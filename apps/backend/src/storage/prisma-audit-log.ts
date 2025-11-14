/**
 * Prisma-based Audit Log Storage
 *
 * Persistent audit log implementation using PostgreSQL
 */

import type { AuditLogEntry, AuditLogStorage, TimeRange } from '@siwats/chronocrypt';
import { prisma } from '../lib/prisma';

export class PrismaAuditLog implements AuditLogStorage {
  /**
   * Append entry to audit log
   */
  async append(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        actor: entry.actor,
        target: entry.target,
        startTime: entry.timeRange?.startTime,
        endTime: entry.timeRange?.endTime,
        success: entry.success,
        details: entry.details as any,
      },
    });
  }

  /**
   * Retrieve audit log entries for time range
   */
  async retrieve(range: TimeRange): Promise<AuditLogEntry[]> {
    const entries = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: range.startTime,
          lte: range.endTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return entries.map(this.toAuditLogEntry);
  }

  /**
   * Retrieve audit log entries by event type
   */
  async retrieveByEventType(
    eventType: AuditLogEntry['eventType']
  ): Promise<AuditLogEntry[]> {
    const entries = await prisma.auditLog.findMany({
      where: {
        eventType,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return entries.map(this.toAuditLogEntry);
  }

  /**
   * Retrieve audit log entries by actor
   */
  async retrieveByActor(actor: string): Promise<AuditLogEntry[]> {
    const entries = await prisma.auditLog.findMany({
      where: {
        actor,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return entries.map(this.toAuditLogEntry);
  }

  /**
   * Get all audit log entries
   */
  async getAll(): Promise<AuditLogEntry[]> {
    const entries = await prisma.auditLog.findMany({
      orderBy: {
        timestamp: 'asc',
      },
    });

    return entries.map(this.toAuditLogEntry);
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    entriesByActor: Record<string, number>;
    successRate: number;
  }> {
    const [total, byType, byActor, successCount] = await Promise.all([
      // Total entries
      prisma.auditLog.count(),

      // Entries by type
      prisma.auditLog.groupBy({
        by: ['eventType'],
        _count: true,
      }),

      // Entries by actor
      prisma.auditLog.groupBy({
        by: ['actor'],
        _count: true,
      }),

      // Success count
      prisma.auditLog.count({
        where: {
          success: true,
        },
      }),
    ]);

    const entriesByType: Record<string, number> = {};
    byType.forEach((item) => {
      entriesByType[item.eventType] = item._count;
    });

    const entriesByActor: Record<string, number> = {};
    byActor.forEach((item) => {
      entriesByActor[item.actor] = item._count;
    });

    const successRate = total > 0 ? successCount / total : 0;

    return {
      totalEntries: total,
      entriesByType,
      entriesByActor,
      successRate,
    };
  }

  /**
   * Get number of entries
   */
  async size(): Promise<number> {
    return await prisma.auditLog.count();
  }

  /**
   * Clear all entries (for testing only)
   */
  async clear(): Promise<void> {
    await prisma.auditLog.deleteMany();
  }

  /**
   * Convert Prisma model to AuditLogEntry
   */
  private toAuditLogEntry(entry: any): AuditLogEntry {
    return {
      id: entry.id,
      timestamp: Number(entry.timestamp),
      eventType: entry.eventType as AuditLogEntry['eventType'],
      actor: entry.actor,
      target: entry.target || undefined,
      timeRange:
        entry.startTime && entry.endTime
          ? {
              startTime: Number(entry.startTime),
              endTime: Number(entry.endTime),
            }
          : undefined,
      success: entry.success,
      details: entry.details as Record<string, unknown> | undefined,
    };
  }
}
