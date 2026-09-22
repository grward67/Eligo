import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface AddCandidateResult {
  ok: boolean;
  error?: "NOT_FOUND" | "NOT_DRAFT";
  candidate?: { id: string; name: string; party: string | null };
}

/**
 * Candidates (STV/FPTP) can only be added while an election is still DRAFT.
 * Once it's open, the roster voters are choosing from has to stay fixed --
 * adding a name after votes are already being cast would make results
 * ambiguous about who had a fair chance to be selected.
 */
export async function addCandidate(electionId: string, name: string, party: string | null, addedById: string): Promise<AddCandidateResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return { ok: false, error: "NOT_FOUND" };
  if (election.status !== "DRAFT") return { ok: false, error: "NOT_DRAFT" };

  const count = await prisma.candidate.count({ where: { electionId } });
  const candidate = await prisma.candidate.create({
    data: { electionId, name, party, sortOrder: count },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: addedById,
    action: "candidate.create",
    targetType: "Election",
    targetId: electionId,
    metadata: { candidateId: candidate.id, name: candidate.name },
  });

  return { ok: true, candidate: { id: candidate.id, name: candidate.name, party: candidate.party } };
}

export interface UpdateCandidateResult {
  ok: boolean;
  error?: "NOT_FOUND" | "NOT_DRAFT";
  candidate?: { id: string; name: string; party: string | null };
}

/** Same DRAFT-only lock as addCandidate -- editing a name/party after voting has started would be just as disruptive as adding a new one. */
export async function updateCandidate(candidateId: string, name: string, party: string | null, updatedById: string): Promise<UpdateCandidateResult> {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return { ok: false, error: "NOT_FOUND" };

  const election = await prisma.election.findUnique({ where: { id: candidate.electionId } });
  if (!election || election.status !== "DRAFT") return { ok: false, error: "NOT_DRAFT" };

  const updated = await prisma.candidate.update({ where: { id: candidateId }, data: { name, party } });

  await writeAuditLog({
    actorType: "admin",
    actorId: updatedById,
    action: "candidate.update",
    targetType: "Candidate",
    targetId: candidateId,
    metadata: { name: updated.name, party: updated.party },
  });

  return { ok: true, candidate: { id: updated.id, name: updated.name, party: updated.party } };
}
