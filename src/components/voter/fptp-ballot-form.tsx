"use client";

import { useState } from "react";

interface Candidate {
  id: string;
  name: string;
  party: string | null;
}

export function FptpBallotForm({ electionId, candidates }: { electionId: string; candidates: Candidate[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selected) {
      setError("Choose a candidate to vote for.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/voter/ballot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId, ranking: [selected] }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not submit your ballot. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="ballot-submitted">
        <h2>Thank you for voting!</h2>
        <p>Your ballot has been successfully registered.</p>
      </div>
    );
  }

  return (
    <div className="ballot-form">
      <ul className="candidate-list" role="radiogroup" aria-label="Candidates">
        {candidates.map((c) => {
          const isSelected = selected === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={isSelected ? "cand-btn ranked" : "cand-btn"}
                onClick={() => setSelected(c.id)}
              >
                <span className="rank-badge">{isSelected ? "✓" : ""}</span>
                <span>
                  <span className="cand-name">{c.name}</span>
                  {c.party && <span className="cand-party">{c.party}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="form-error">{error}</p>}
      <button type="button" className="submit-btn" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit ballot"}
      </button>
    </div>
  );
}
