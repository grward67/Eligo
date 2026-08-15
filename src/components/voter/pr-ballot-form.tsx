"use client";

import { useState } from "react";
import { PR_BLANK_VOTE_VALUE } from "@/lib/pr/count";

interface PartyList {
  id: string;
  name: string;
  abbreviation: string;
}

export function PrBallotForm({
  electionId,
  lists,
  allowBlankVote,
}: {
  electionId: string;
  lists: PartyList[];
  allowBlankVote: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selected) {
      setError("Choose a list to vote for.");
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

  const options = allowBlankVote ? [...lists, { id: PR_BLANK_VOTE_VALUE, name: "Blank vote", abbreviation: "" }] : lists;

  return (
    <div className="ballot-form">
      <ul className="candidate-list" role="radiogroup" aria-label="Lists">
        {options.map((l) => {
          const isSelected = selected === l.id;
          return (
            <li key={l.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={isSelected ? "cand-btn ranked" : "cand-btn"}
                onClick={() => setSelected(l.id)}
              >
                <span className="rank-badge">{isSelected ? "✓" : ""}</span>
                <span>
                  <span className="cand-name">{l.name}</span>
                  {l.abbreviation && <span className="cand-party">{l.abbreviation}</span>}
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
