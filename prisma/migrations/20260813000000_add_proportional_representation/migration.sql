ALTER TABLE "Election" ADD COLUMN "prThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Election" ADD COLUMN "prCalculationMethod" TEXT NOT NULL DEFAULT 'DHONDT';
ALTER TABLE "Election" ADD COLUMN "prAllowBlankVote" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PartyList" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PartyList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyListCandidate" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "PartyListCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartyList_electionId_idx" ON "PartyList"("electionId");

CREATE INDEX "PartyListCandidate_listId_idx" ON "PartyListCandidate"("listId");

ALTER TABLE "PartyList" ADD CONSTRAINT "PartyList_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyListCandidate" ADD CONSTRAINT "PartyListCandidate_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PartyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
