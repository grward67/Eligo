// Minimal in-memory stand-in for the subset of PrismaClient the service
// layer touches. Lets ballot-service tests run without a real database.

export interface FakeElection {
  id: string;
  status: string;
}

export interface FakeCandidate {
  id: string;
  electionId: string;
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

export function createFakePrisma() {
  const elections: FakeElection[] = [];
  const candidates: FakeCandidate[] = [];
  const voterSessions: FakeVoterSession[] = [];
  const ballots: FakeBallot[] = [];
  const auditLogs: unknown[] = [];
  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  const fake = {
    _data: { elections, candidates, voterSessions, ballots, auditLogs },

    election: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        elections.find((e) => e.id === where.id) ?? null,
      create: async ({ data }: { data: Partial<FakeElection> }) => {
        const row = { id: nextId(), status: "DRAFT", ...data } as FakeElection;
        elections.push(row);
        return row;
      },
    },

    candidate: {
      findMany: async ({ where }: { where: { electionId: string } }) =>
        candidates.filter((c) => c.electionId === where.electionId),
    },

    voterSession: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        voterSessions.find((v) => v.id === where.id) ?? null,
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
    },

    ballot: {
      create: async ({ data }: { data: Partial<FakeBallot> }) => {
        const row = { id: nextId(), submittedAt: new Date(), ...data } as FakeBallot;
        ballots.push(row);
        return row;
      },
    },

    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        auditLogs.push(data);
        return data;
      },
    },

    async $transaction<T>(fnOrArray: ((tx: typeof fake) => Promise<T>) | Promise<unknown>[]): Promise<T> {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray) as unknown as T;
      }
      return fnOrArray(fake);
    },
  };

  return fake;
}
