import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface DeleteElectionsResult {
  deletedIds: string[];
  blocked: { id: string; title: string }[];
}

/**
 * Deletes the given elections, except any still OPEN ("running") -- those
 * are reported back in `blocked` instead, untouched, so the admin can stop
 * them first. Deletable elections have their dependent rows removed
 * explicitly in dependency order (Ballot before VoterSession, since Ballot
 * also references VoterSession directly) rather than relying solely on the
 * database's ON DELETE CASCADE.
 */
export async function deleteElections(electionIds: string[], deletedById: string): Promise<DeleteElectionsResult> {
  const elections = await prisma.election.findMany({
    where: { id: { in: electionIds } },
    select: { id: true, title: true, status: true },
  });

  const blocked = elections.filter((e) => e.status === "OPEN");
  const deletable = elections.filter((e) => e.status !== "OPEN");

  if (deletable.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const e of deletable) {
        await tx.ballot.deleteMany({ where: { electionId: e.id } });
        await tx.voterSession.deleteMany({ where: { electionId: e.id } });
        await tx.accessCode.deleteMany({ where: { electionId: e.id } });
        await tx.candidate.deleteMany({ where: { electionId: e.id } });
        await tx.election.delete({ where: { id: e.id } });
      }
    });

    for (const e of deletable) {
      await writeAuditLog({
        actorType: "admin",
        actorId: deletedById,
        action: "election.delete",
        targetType: "Election",
        targetId: e.id,
        metadata: { title: e.title, status: e.status },
      });
    }
  }

  return {
    deletedIds: deletable.map((e) => e.id),
    blocked: blocked.map((e) => ({ id: e.id, title: e.title })),
  };
}
