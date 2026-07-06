"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  id: string;
  name: string;
  party: string | null;
}

export function BallotForm({ electionId, candidates }: { electionId: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [ranking, setRanking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggle(id: string) {
    setRanking((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setRanking((prev) => {
      const idx = prev.indexOf(id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  async function handleSubmit() {
    if (ranking.length === 0) {
      setError("Rank at least one candidate.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/voter/ballot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId, ranking }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit your ballot. Please try again.");
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="ballot-submitted">
        <h2>Ballot submitted</h2>
        <p>Thank you for voting.</p>
      </div>
    );
  }

  return (
    <div className="ballot-form">
      <ul className="candidate-list">
        {candidates.map((c) => {
          const rankIdx = ranking.indexOf(c.id);
          const ranked = rankIdx !== -1;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={ranked ? "cand-btn ranked" : "cand-btn"}
                onClick={() => toggle(c.id)}
              >
                <span className="rank-badge">{ranked ? rankIdx + 1 : ""}</span>
                <span>
                  <span className="cand-name">{c.name}</span>
                  {c.party && <span className="cand-party">{c.party}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {ranking.length > 0 && (
        <ol className="ranking-preview">
          {ranking.map((id, i) => {
            const c = candidates.find((x) => x.id === id);
            if (!c) return null;
            return (
              <li key={id}>
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{c.name}</span>
                <button type="button" onClick={() => move(id, -1)} disabled={i === 0}>
                  &uarr;
                </button>
                <button type="button" onClick={() => move(id, 1)} disabled={i === ranking.length - 1}>
                  &darr;
                </button>
                <button type="button" onClick={() => toggle(id)}>
                  &times;
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {error && <p className="form-error">{error}</p>}
      <button type="button" className="submit-btn" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit ballot"}
      </button>
    </div>
  );
}
