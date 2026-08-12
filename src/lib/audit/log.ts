import { prisma } from "@/lib/db";

export type AuditActorType = "admin" | "voter" | "system";

export interface AuditLogInput {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Backdates the entry -- used only for system-applied scheduled transitions, so the recorded instant matches the scheduled time rather than whenever the lazy check happened to run. Omit to use the write time (the default for every other caller). */
  createdAt?: Date;
}

/** Central write path for every auditable event: admin actions, code use, ballot submission. */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}
