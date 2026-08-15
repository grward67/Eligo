import { prisma } from "@/lib/db";
import { runSTV, StvValidationError } from "@/lib/stv/count";
import { runFPTP, FptpValidationError } from "@/lib/fptp/count";
import { runPR, PrValidationError } from "@/lib/pr/count";
import { VotingLogButton } from "@/components/admin/voting-log-button";
import { ElectionCountLogButton } from "@/components/admin/election-count-log-button";
import { applyDueScheduleTransitions } from "@/lib/services/election-schedule-service";

function fmtNum(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export default async function ResultsPage({ params }: { params: { electionId: string } }) {
  await applyDueScheduleTransitions(params.electionId);

  const election = await prisma.election.findUnique({
    where: { id: params.electionId },
    include: { candidates: true, partyLists: { orderBy: { sortOrder: "asc" }, include: { candidates: true } } },
  });

  if (!election) {
    return <p>Election not found.</p>;
  }

  const ballots = await prisma.ballot.findMany({ where: { electionId: params.electionId } });

  if (ballots.length === 0) {
    return (
      <div>
        <h1>Results: {election.title}</h1>
        <p>No ballots have been submitted yet.</p>
      </div>
    );
  }

  const header = (
    <>
      <h1>Results: {election.title}</h1>
      <p>{ballots.length} ballot(s) cast.</p>
      <VotingLogButton electionId={params.electionId} />
      <ElectionCountLogButton electionId={params.electionId} />
    </>
  );

  if (election.votingSystem === "FPTP") {
    let result;
    try {
      result = runFPTP(
        election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
        election.seats,
        ballots.map((b) => ({ ranking: JSON.parse(b.ranking) as string[] }))
      );
    } catch (err) {
      const message = err instanceof FptpValidationError ? err.message : "Could not compute results.";
      return (
        <div>
          {header}
          <p>{message}</p>
        </div>
      );
    }

    return (
      <div>
        {header}
        <h2>Winners</h2>
        <ol>
          {result.winners.map((w) => (
            <li key={w.id}>
              {w.name}
              {w.party ? ` (${w.party})` : ""}
            </li>
          ))}
        </ol>

        <h2>Final count</h2>
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Votes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.tallies.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.votes}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (election.votingSystem === "PR") {
    let result;
    try {
      result = runPR(
        election.partyLists.map((l) => ({
          id: l.id,
          name: l.name,
          abbreviation: l.abbreviation,
          candidates: l.candidates.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, rank: c.rank })),
        })),
        election.seats,
        election.prThreshold,
        election.prCalculationMethod as "DHONDT" | "SAINTE_LAGUE",
        election.prAllowBlankVote,
        ballots.map((b) => ({ ranking: JSON.parse(b.ranking) as string[] }))
      );
    } catch (err) {
      const message = err instanceof PrValidationError ? err.message : "Could not compute results.";
      return (
        <div>
          {header}
          <p>{message}</p>
        </div>
      );
    }

    return (
      <div>
        {header}
        <p>
          {result.totalValidVotes} valid vote(s){result.blankVotes > 0 ? `, ${result.blankVotes} blank vote(s)` : ""}. Threshold:{" "}
          {result.threshold}%.
        </p>

        <h2>Winners</h2>
        {result.lists.map((l) => (
          <div key={l.id}>
            <h3>
              {l.name} ({l.abbreviation}) &mdash; {l.seatsWon} seat(s)
            </h3>
            {l.seatsWon > 0 && (
              <ol>
                {l.candidates
                  .filter((c) => c.status === "elected")
                  .map((c) => (
                    <li key={c.id}>
                      {c.firstName} {c.lastName}
                    </li>
                  ))}
              </ol>
            )}
          </div>
        ))}

        <h2>Final count</h2>
        <table>
          <thead>
            <tr>
              <th>List</th>
              <th>Votes</th>
              <th>%</th>
              <th>Seats won (raw)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {result.lists.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.name} ({l.abbreviation})
                </td>
                <td>{l.votes}</td>
                <td>{fmtNum(l.votePercent)}%</td>
                <td>
                  {l.seatsWon} ({l.idealSeats.toFixed(1)})
                </td>
                <td>{l.excludedByThreshold ? "Excluded (below threshold)" : "Eligible"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {result.tieBreaks.length > 0 && (
          <>
            <h2>Tie-breaks</h2>
            <ul>
              {result.tieBreaks.map((t, i) => {
                const names = t.tiedListIds.map((id) => result!.lists.find((l) => l.id === id)?.abbreviation ?? id).join(", ");
                const winnerName = result!.lists.find((l) => l.id === t.winnerId)?.abbreviation ?? t.winnerId;
                return (
                  <li key={i}>
                    Seat {t.seatNumber}: tie between {names}, resolved in favor of {winnerName} (
                    {t.method === "votes" ? "more total votes" : "random draw"}).
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    );
  }

  let result;
  try {
    result = runSTV(
      election.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party })),
      election.seats,
      ballots.map((b) => ({ ranking: JSON.parse(b.ranking) as string[] }))
    );
  } catch (err) {
    const message = err instanceof StvValidationError ? err.message : "Could not compute results.";
    return (
      <div>
        {header}
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div>
      {header}
      <p>Droop quota: {result.quota}.</p>

      <h2>Winners</h2>
      <ol>
        {result.winners.map((w) => (
          <li key={w.id}>
            {w.name}
            {w.party ? ` (${w.party})` : ""}
          </li>
        ))}
      </ol>

      <h2>Audit trail</h2>
      {result.rounds.map((r) => (
        <div key={r.number} className="round-card">
          <h3>
            Round {r.number} &mdash; {r.action}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Votes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {r.tallies.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{fmtNum(t.votes)}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{r.note}</p>
          {(r.exhausted > 1e-9 || r.cumulativeExhausted > 1e-9) && (
            <p>
              {r.exhausted > 1e-9 && (
                <>
                  <strong>{fmtNum(r.exhausted)}</strong> vote(s) newly exhausted this round.{" "}
                </>
              )}
              Exhausted in total so far: <strong>{fmtNum(r.cumulativeExhausted)}</strong>.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
