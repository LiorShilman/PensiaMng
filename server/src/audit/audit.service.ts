import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** יומן גישה ופעולות (מפרט §11) — מי עשה מה ומתי, ללא תוכן רגיש */

export interface AuditEntry {
  action: string;
  success: boolean;
  ip: string | null;
  detail: string | null;
  createdAt: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string | null;
    email?: string | null;
    action: string;
    success?: boolean;
    ip?: string | null;
    userAgent?: string | null;
    detail?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          email: params.email ?? null,
          action: params.action,
          success: params.success ?? true,
          ip: params.ip ?? null,
          userAgent: params.userAgent ?? null,
          detail: params.detail ?? null,
        },
      });
    } catch {
      // רישום היומן לעולם לא מפיל את הפעולה עצמה
    }
  }

  async list(userId: string, take = 30): Promise<AuditEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => ({
      action: r.action,
      success: r.success,
      ip: r.ip,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
