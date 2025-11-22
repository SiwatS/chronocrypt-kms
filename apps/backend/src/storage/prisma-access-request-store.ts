/**
 * Prisma-based Access Request Storage
 *
 * Store access request history for tracking and analytics
 */

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { AccessRequest, AccessResponse } from '@siwats/chronocrypt';

export interface AccessRequestRecord {
  id: string;
  requesterId: string;
  startTime: number;
  endTime: number;
  purpose?: string;
  metadata?: Record<string, unknown>;
  granted: boolean;
  denialReason?: string;
  keyCount?: number;
  createdAt: Date;
}

export class PrismaAccessRequestStore {
  /**
   * Save an access request and its result
   */
  async save(request: AccessRequest, response: AccessResponse): Promise<string> {
    const record = await prisma.accessRequest.create({
      data: {
        requesterId: request.requesterId,
        startTime: request.timeRange.startTime,
        endTime: request.timeRange.endTime,
        purpose: request.purpose,
        metadata: request.metadata,
        granted: response.granted,
        denialReason: response.denialReason,
        keyCount: response.privateKeys ? response.privateKeys.size : undefined,
      },
    });

    return record.id;
  }

  /**
   * Get access requests with filtering
   */
  async getRequests(options?: {
    requesterId?: string;
    startTime?: number;
    endTime?: number;
    granted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ requests: AccessRequestRecord[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (options?.requesterId) {
      where.requesterId = options.requesterId;
    }

    if (options?.startTime && options?.endTime) {
      where.AND = [
        { startTime: { gte: options.startTime } },
        { endTime: { lte: options.endTime } },
      ];
    }

    if (options?.granted !== undefined) {
      where.granted = options.granted;
    }

    const [requests, total] = await Promise.all([
      prisma.accessRequest.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.accessRequest.count({ where }),
    ]);

    return {
      requests: requests.map(this.toAccessRequestRecord),
      total,
    };
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    granted: number;
    denied: number;
    last24Hours: number;
  }> {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const [total, granted, denied, last24Hours] = await Promise.all([
      prisma.accessRequest.count(),
      prisma.accessRequest.count({ where: { granted: true } }),
      prisma.accessRequest.count({ where: { granted: false } }),
      prisma.accessRequest.count({
        where: {
          createdAt: {
            gte: new Date(twentyFourHoursAgo),
          },
        },
      }),
    ]);

    return {
      total,
      granted,
      denied,
      last24Hours,
    };
  }

  /**
   * Get request by ID
   */
  async getById(id: string): Promise<AccessRequestRecord | null> {
    const request = await prisma.accessRequest.findUnique({
      where: { id },
    });

    return request ? this.toAccessRequestRecord(request) : null;
  }

  /**
   * Convert Prisma model to AccessRequestRecord
   */
  private toAccessRequestRecord(record: { id: string; requesterId: string; startTime: bigint; endTime: bigint; purpose: string | null; metadata: unknown; granted: boolean; denialReason: string | null; keyCount: number | null; createdAt: Date }): AccessRequestRecord {
    return {
      id: record.id,
      requesterId: record.requesterId,
      startTime: Number(record.startTime),
      endTime: Number(record.endTime),
      purpose: record.purpose || undefined,
      metadata: record.metadata as Record<string, unknown> | undefined,
      granted: record.granted,
      denialReason: record.denialReason || undefined,
      keyCount: record.keyCount || undefined,
      createdAt: record.createdAt,
    };
  }
}
