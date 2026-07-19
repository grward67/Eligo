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

export interface FakeAccessCode {
  id: string;
  electionId: string;
  codeHash: string;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  expiresAt: Date | null;
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

export interface FakePrismaClient {
  _data: {
    elections: FakeElection[];
    candidates: FakeCandidate[];
    accessCodes: FakeAccessCode[];
    voterSessions: FakeVoterSession[];
    ballots: FakeBallot[];
    auditLogs: unknown[];
  };
  election: {
    findUnique: (args: { where: { id: string } }) => Promise<FakeElection | null>;
    create: (args: { data: Partial<FakeElection> }) => Promise<FakeElection>;
  };
  candidate: {
    findMany: (args: { where: { electionId: string } }) => Promise<FakeCandidate[]>;
  };
  accessCode: {
    findFirst: (args: { where: { electionId: string; codeHash: string } }) => Promise<FakeAccessCode | null>;
    findUnique: (args: { where: { id: string } }) => Promise<FakeAccessCode | null>;
    create: (args: { data: Partial<FakeAccessCode> }) => Promise<FakeAccessCode>;
    update: (args: { where: { id: string }; data: Partial<FakeAccessCode> }) => Promise<FakeAccessCode>;
  };
  voterSession: {
    findUnique: (args: { where: { id: string } }) => Promise<FakeVoterSession | null>;
    findFirst: (
      args: { where: { accessCodeId: string; ballotSubmitted: boolean } }
    ) => Promise<FakeVoterSession | null>;
    create: (args: { data: Partial<FakeVoterSession> }) => Promise<FakeVoterSession>;
    update: (args: { where: { id: string }; data: Partial<FakeVoterSession> }) => Promise<FakeVoterSession>;
  };
  ballot: {
    create: (args: { data: Partial<FakeBallot> }) => Promise<FakeBallot>;
  };
  auditLog: {
    create: (args: { data: unknown }) => Promise<unknown>;
  };
  $transaction<T>(fnOrArray: ((tx: FakePrismaClient) => Promise<T>) | Promise<unknown>[]): Promise<T>;
}

export function createFakePrisma(): FakePrismaClient {
  const elections: FakeElection[] = [];
  const candidates: FakeCandidate[] = [];
  const accessCodes: FakeAccessCode[] = [];
  const voterSessions: FakeVoterSession[] = [];
  const ballots: FakeBallot[] = [];
  const auditLogs: unknown[] = [];
  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  const fake: FakePrismaClient = {
    _data: { elections, candidates, accessCodes, voterSessions, ballots, auditLogs },

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

    accessCode: {
      findFirst: async ({ where }: { where: { electionId: string; codeHash: string } }) =>
        accessCodes.find((c) => c.electionId === where.electionId && c.codeHash === where.codeHash) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        accessCodes.find((c) => c.id === where.id) ?? null,
      create: async ({ data }: { data: Partial<FakeAccessCode> }) => {
        const row = {
          id: nextId(),
          useCount: 0,
          active: true,
          maxUses: null,
          expiresAt: null,
          ...data,
        } as FakeAccessCode;
        accessCodes.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeAccessCode> }) => {
        const row = accessCodes.find((c) => c.id === where.id);
        if (!row) throw new Error("accessCode not found");
        Object.assign(row, data);
        return row;
      },
    },

    voterSession: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        voterSessions.find((v) => v.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { accessCodeId: string; ballotSubmitted: boolean } }) =>
        voterSessions.find(
          (v) => v.accessCodeId === where.accessCodeId && v.ballotSubmitted === where.ballotSubmitted
        ) ?? null,
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

    async $transaction<T>(fnOrArray: ((tx: FakePrismaClient) => Promise<T>) | Promise<unknown>[]): Promise<T> {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray) as unknown as T;
      }
      return fnOrArray(fake);
    },
  };

  return fake;
}
