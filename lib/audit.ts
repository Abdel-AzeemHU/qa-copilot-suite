import { prisma } from "@/lib/db/prisma";

export interface AuditEntry {
  orgId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/**
 * Fire-and-forget audit log writer.
 * Errors are logged to console but do not surface to callers.
 */
export function logAudit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        orgId: entry.orgId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
        ip: entry.ip ?? null,
      },
    })
    .catch(console.error);
}
