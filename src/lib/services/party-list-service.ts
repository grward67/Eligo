import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit/log";

export interface CreatePartyListResult {
  ok: boolean;
  error?: "NOT_FOUND" | "NOT_DRAFT";
  list?: { id: string; name: string; abbreviation: string };
  /** Non-blocking: the list has fewer candidates than the election's total seats so far. */
  warning?: string;
}

export interface AddListCandidateResult {
  ok: boolean;
  error?: "LIST_NOT_FOUND" | "NOT_DRAFT";
  candidate?: { id: string; firstName: string; lastName: string; rank: number };
  warning?: string;
}

function underfilledWarning(candidateCount: number, seats: number): string | undefined {
  return candidateCount < seats
    ? `This list has ${candidateCount} candidate(s), fewer than the ${seats} total seat(s) -- it must reach at least ${seats} before the election can be opened.`
    : undefined;
}

/** Lists (like candidates) can only be added while an election is still DRAFT -- see addCandidate for why. */
export async function createPartyList(electionId: string, name: string, abbreviation: string, createdById: string): Promise<CreatePartyListResult> {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) return { ok: false, error: "NOT_FOUND" };
  if (election.status !== "DRAFT") return { ok: false, error: "NOT_DRAFT" };

  const count = await prisma.partyList.count({ where: { electionId } });
  const list = await prisma.partyList.create({
    data: { electionId, name, abbreviation, sortOrder: count },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: createdById,
    action: "partylist.create",
    targetType: "Election",
    targetId: electionId,
    metadata: { listId: list.id, name: list.name, abbreviation: list.abbreviation },
  });

  return { ok: true, list: { id: list.id, name: list.name, abbreviation: list.abbreviation }, warning: underfilledWarning(0, election.seats) };
}

/** Candidates within a list follow the same DRAFT-only lock as the list itself. */
export async function addListCandidate(listId: string, firstName: string, lastName: string, addedById: string): Promise<AddListCandidateResult> {
  const list = await prisma.partyList.findUnique({ where: { id: listId } });
  if (!list) return { ok: false, error: "LIST_NOT_FOUND" };

  const election = await prisma.election.findUnique({ where: { id: list.electionId } });
  if (!election || election.status !== "DRAFT") return { ok: false, error: "NOT_DRAFT" };

  const count = await prisma.partyListCandidate.count({ where: { listId } });
  const candidate = await prisma.partyListCandidate.create({
    data: { listId, firstName, lastName, rank: count + 1 },
  });

  await writeAuditLog({
    actorType: "admin",
    actorId: addedById,
    action: "partylistcandidate.create",
    targetType: "PartyList",
    targetId: listId,
    metadata: { candidateId: candidate.id, firstName, lastName, rank: candidate.rank },
  });

  return {
    ok: true,
    candidate: { id: candidate.id, firstName: candidate.firstName, lastName: candidate.lastName, rank: candidate.rank },
    warning: underfilledWarning(count + 1, election.seats),
  };
}
