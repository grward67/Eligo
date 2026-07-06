import { prisma } from "@/lib/db";
import { runSTV, StvValidationError } from "@/lib/stv/count";

export default async function ResultsPage({ params }: { params: { electionId: string } }) {
  const election = await prisma.election.findUnique({
    where: { id: params.electionId },
    include: { candidates: true },
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
        <h1>Results: {election.title}</h1>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Results: {election.title}</h1>
      <p>
        {ballots.length} ballot(s) cast. Droop quota: {result.quota}.
      </p>

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
                  <td>{t.votes.toFixed(4).replace(/\.?0+$/, "")}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{r.note}</p>
          {r.exhausted > 1e-9 && (
            <p>
              <strong>{r.exhausted.toFixed(4).replace(/\.?0+$/, "")}</strong> vote(s) exhausted so far.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
