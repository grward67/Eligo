// Minimal in-memory stand-in for the subset of PrismaClient the service
// layer touches. Lets service-layer tests run without a real database.

export interface FakeElection {
  id: string;
  title: string;
  status: string;
  votingSystem?: string;
  seats?: number;
}

export interface FakeCandidate {
  id: string;
  electionId: string;
  name?: string;
  party?: string | null;
  sortOrder?: number;
}

export interface FakeAccessCode {
  id: string;
  electionId: string;
  codeHash: string;
  label?: string | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt?: Date;
}

export interface FakeVoterSession {
  id: string;
  electionId: string;
  accessCodeId: string;
  ballotSubmitted: boolean;
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface FakeBallot {
  id: string;
  electionId: string;
  voterSessionId: string;
  ranking: string;
  submittedAt: Date;
}

export interface FakeAuditLog {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface FakePrismaClient {
  _data: {
    elections: FakeElection[];
    candidates: FakeCandidate[];
    accessCodes: FakeAccessCode[];
    voterSessions: FakeVoterSession[];
    ballots: FakeBallot[];
    auditLogs: FakeAuditLog[];
  };
  election: {
    findUnique: (args: {
      where: { id: string };
      include?: { candidates?: { orderBy?: { sortOrder: "asc" } } };
    }) => Promise<(FakeElection & { candidates?: FakeCandidate[] }) | null>;
    findMany: (args: { where: { id: { in: string[] } } }) => Promise<FakeElection[]>;
    create: (args: { data: Partial<FakeElection> }) => Promise<FakeElection>;
    update: (args: { where: { id: string }; data: Partial<FakeElection> }) => Promise<FakeElection>;
    delete: (args: { where: { id: string } }) => Promise<FakeElection>;
  };
  candidate: {
    findMany: (args: { where: { electionId: string } }) => Promise<FakeCandidate[]>;
    deleteMany: (args: { where: { electionId: string } }) => Promise<{ count: number }>;
  };
  accessCode: {
    findFirst: (args: { where: { electionId: string; codeHash: string } }) => Promise<FakeAccessCode | null>;
    findUnique: (args: {
      where: { id?: string; codeHash?: string };
      include?: { election?: { select: { title: true } } };
    }) => Promise<(FakeAccessCode & { election?: { title: string } }) | null>;
    create: (args: { data: Partial<FakeAccessCode> }) => Promise<FakeAccessCode>;
    createMany: (args: { data: Partial<FakeAccessCode>[] }) => Promise<{ count: number }>;
    update: (args: { where: { id: string }; data: Partial<FakeAccessCode> }) => Promise<FakeAccessCode>;
    deleteMany: (args: { where: { electionId: string } }) => Promise<{ count: number }>;
  };
  voterSession: {
    findUnique: (args: { where: { id: string } }) => Promise<FakeVoterSession | null>;
    findFirst: (args: {
      where: { accessCodeId: string; ballotSubmitted: boolean };
      include?: { ballot?: { select: { id?: true; submittedAt: true } } };
    }) => Promise<(FakeVoterSession & { ballot?: { id: string; submittedAt: Date } | null }) | null>;
    create: (args: { data: Partial<FakeVoterSession> }) => Promise<FakeVoterSession>;
    update: (args: { where: { id: string }; data: Partial<FakeVoterSession> }) => Promise<FakeVoterSession>;
    deleteMany: (args: { where: { electionId: string } }) => Promise<{ count: number }>;
  };
  ballot: {
    findUnique: (args: { where: { id: string } }) => Promise<FakeBallot | null>;
    findMany: (args: {
      where: { electionId: string };
      orderBy?: { submittedAt: "asc" | "desc" };
    }) => Promise<FakeBallot[]>;
    create: (args: { data: Partial<FakeBallot> }) => Promise<FakeBallot>;
    delete: (args: { where: { id: string } }) => Promise<FakeBallot>;
    deleteMany: (args: { where: { electionId: string } }) => Promise<{ count: number }>;
  };
  auditLog: {
    create: (args: { data: Partial<FakeAuditLog> }) => Promise<FakeAuditLog>;
    findMany: (args: {
      where?: { targetType?: string; targetId?: string; action?: string; actorId?: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }) => Promise<FakeAuditLog[]>;
  };
  $transaction<T>(fnOrArray: ((tx: FakePrismaClient) => Promise<T>) | Promise<unknown>[]): Promise<T>;
}

export function createFakePrisma(): FakePrismaClient {
  const elections: FakeElection[] = [];
  const candidates: FakeCandidate[] = [];
  const accessCodes: FakeAccessCode[] = [];
  const voterSessions: FakeVoterSession[] = [];
  const ballots: FakeBallot[] = [];
  const auditLogs: FakeAuditLog[] = [];
  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  const fake: FakePrismaClient = {
    _data: { elections, candidates, accessCodes, voterSessions, ballots, auditLogs },

    election: {
      findUnique: async ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { candidates?: { orderBy?: { sortOrder: "asc" } } };
      }) => {
        const row = elections.find((e) => e.id === where.id);
        if (!row) return null;
        if (include?.candidates) {
          const rowCandidates = candidates
            .filter((c) => c.electionId === row.id)
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          return { ...row, candidates: rowCandidates };
        }
        return row;
      },
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        elections.filter((e) => where.id.in.includes(e.id)),
      create: async ({ data }: { data: Partial<FakeElection> }) => {
        const row = {
          id: nextId(),
          title: "Untitled",
          status: "DRAFT",
          votingSystem: "STV",
          ...data,
        } as FakeElection;
        elections.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeElection> }) => {
        const row = elections.find((e) => e.id === where.id);
        if (!row) throw new Error("election not found");
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = elections.findIndex((e) => e.id === where.id);
        if (idx === -1) throw new Error("election not found");
        const [row] = elections.splice(idx, 1);
        return row;
      },
    },

    candidate: {
      findMany: async ({ where }: { where: { electionId: string } }) =>
        candidates.filter((c) => c.electionId === where.electionId),
      deleteMany: async ({ where }: { where: { electionId: string } }) => {
        const before = candidates.length;
        const remaining = candidates.filter((c) => c.electionId !== where.electionId);
        candidates.length = 0;
        candidates.push(...remaining);
        return { count: before - candidates.length };
      },
    },

    accessCode: {
      findFirst: async ({ where }: { where: { electionId: string; codeHash: string } }) =>
        accessCodes.find((c) => c.electionId === where.electionId && c.codeHash === where.codeHash) ?? null,
      findUnique: async ({
        where,
        include,
      }: {
        where: { id?: string; codeHash?: string };
        include?: { election?: { select: { title: true } } };
      }) => {
        const row = accessCodes.find(
          (c) => (where.id !== undefined && c.id === where.id) || (where.codeHash !== undefined && c.codeHash === where.codeHash)
        );
        if (!row) return null;
        if (include?.election) {
          const election = elections.find((e) => e.id === row.electionId);
          return { ...row, election: { title: election?.title ?? "" } };
        }
        return row;
      },
      create: async ({ data }: { data: Partial<FakeAccessCode> }) => {
        const row = {
          id: nextId(),
          label: null,
          useCount: 0,
          active: true,
          maxUses: null,
          expiresAt: null,
          createdAt: new Date(),
          ...data,
        } as FakeAccessCode;
        accessCodes.push(row);
        return row;
      },
      createMany: async ({ data }: { data: Partial<FakeAccessCode>[] }) => {
        for (const d of data) {
          accessCodes.push({
            id: nextId(),
            label: null,
            useCount: 0,
            active: true,
            maxUses: null,
            expiresAt: null,
            createdAt: new Date(),
            ...d,
          } as FakeAccessCode);
        }
        return { count: data.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeAccessCode> }) => {
        const row = accessCodes.find((c) => c.id === where.id);
        if (!row) throw new Error("accessCode not found");
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: { where: { electionId: string } }) => {
        const before = accessCodes.length;
        const remaining = accessCodes.filter((c) => c.electionId !== where.electionId);
        accessCodes.length = 0;
        accessCodes.push(...remaining);
        return { count: before - accessCodes.length };
      },
    },

    voterSession: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        voterSessions.find((v) => v.id === where.id) ?? null,
      findFirst: async ({
        where,
        include,
      }: {
        where: { accessCodeId: string; ballotSubmitted: boolean };
        include?: { ballot?: { select: { id?: true; submittedAt: true } } };
      }) => {
        const row = voterSessions.find(
          (v) => v.accessCodeId === where.accessCodeId && v.ballotSubmitted === where.ballotSubmitted
        );
        if (!row) return null;
        if (include?.ballot) {
          const ballot = ballots.find((b) => b.voterSessionId === row.id);
          return { ...row, ballot: ballot ? { id: ballot.id, submittedAt: ballot.submittedAt } : null };
        }
        return row;
      },
      create: async ({ data }: { data: Partial<FakeVoterSession> }) => {
        const row = {
          id: nextId(),
          ballotSubmitted: false,
          revoked: false,
          createdAt: new Date(),
          ...data,
        } as FakeVoterSession;
        voterSessions.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeVoterSession> }) => {
        const row = voterSessions.find((v) => v.id === where.id);
        if (!row) throw new Error("voterSession not found");
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }: { where: { electionId: string } }) => {
        const before = voterSessions.length;
        const remaining = voterSessions.filter((v) => v.electionId !== where.electionId);
        voterSessions.length = 0;
        voterSessions.push(...remaining);
        return { count: before - voterSessions.length };
      },
    },

    ballot: {
      findUnique: async ({ where }: { where: { id: string } }) => ballots.find((b) => b.id === where.id) ?? null,
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { electionId: string };
        orderBy?: { submittedAt: "asc" | "desc" };
      }) => {
        const rows = ballots.filter((b) => b.electionId === where.electionId).slice();
        if (orderBy?.submittedAt) {
          const dir = orderBy.submittedAt === "asc" ? 1 : -1;
          rows.sort((a, b) => dir * (a.submittedAt.getTime() - b.submittedAt.getTime()));
        }
        return rows;
      },
      create: async ({ data }: { data: Partial<FakeBallot> }) => {
        const row = { id: nextId(), submittedAt: new Date(), ...data } as FakeBallot;
        ballots.push(row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = ballots.findIndex((b) => b.id === where.id);
        if (idx === -1) throw new Error("ballot not found");
        const [row] = ballots.splice(idx, 1);
        return row;
      },
      deleteMany: async ({ where }: { where: { electionId: string } }) => {
        const before = ballots.length;
        const remaining = ballots.filter((b) => b.electionId !== where.electionId);
        ballots.length = 0;
        ballots.push(...remaining);
        return { count: before - ballots.length };
      },
    },

    auditLog: {
      create: async ({ data }: { data: Partial<FakeAuditLog> }) => {
        const row = {
          id: nextId(),
          actorType: "system",
          actorId: null,
          targetType: null,
          targetId: null,
          metadata: null,
          createdAt: new Date(),
          ...data,
        } as FakeAuditLog;
        auditLogs.push(row);
        return row;
      },
      findMany: async ({
        where,
        orderBy,
      }: {
        where?: { targetType?: string; targetId?: string; action?: string; actorId?: string };
        orderBy?: { createdAt: "asc" | "desc" };
      }) => {
        let rows = auditLogs.slice();
        if (where?.targetType !== undefined) rows = rows.filter((r) => r.targetType === where.targetType);
        if (where?.targetId !== undefined) rows = rows.filter((r) => r.targetId === where.targetId);
        if (where?.action !== undefined) rows = rows.filter((r) => r.action === where.action);
        if (where?.actorId !== undefined) rows = rows.filter((r) => r.actorId === where.actorId);
        if (orderBy?.createdAt) {
          const dir = orderBy.createdAt === "asc" ? 1 : -1;
          rows.sort((a, b) => dir * (a.createdAt.getTime() - b.createdAt.getTime()));
        }
        return rows;
      },
    },

    async $transaction<T>(fnOrArray: ((tx: FakePrismaClient) => Promise<T>) | Promise<unknown>[]): Promise<T> {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray) as unknown as T;
      }
      return fnOrArray(fake);
    },
  };

  return fake;
}
