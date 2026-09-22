"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  id: string;
  name: string;
  party: string | null;
}

function CandidateRow({ candidate, editable }: { candidate: Candidate; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(candidate.name);
  const [party, setParty] = useState(candidate.party ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function cancel() {
    setEditing(false);
    setName(candidate.name);
    setParty(candidate.party ?? "");
    setError(null);
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, party: party || null }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save changes.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="candidate-edit-row">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Candidate name" />
        <input value={party} onChange={(e) => setParty(e.target.value)} aria-label="Party (optional)" placeholder="Party (optional)" />
        <button type="button" onClick={handleSave} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={cancel} disabled={submitting} className="cancel-edit-btn">
          Cancel
        </button>
        {error && <p className="form-error">{error}</p>}
      </li>
    );
  }

  return (
    <li>
      {candidate.name}
      {candidate.party ? ` (${candidate.party})` : ""}
      {editable && (
        <button type="button" className="edit-link-btn" onClick={() => setEditing(true)}>
          Edit
        </button>
      )}
    </li>
  );
}

export function CandidateList({ candidates, editable }: { candidates: Candidate[]; editable: boolean }) {
  return (
    <ul>
      {candidates.map((c) => (
        <CandidateRow key={c.id} candidate={c} editable={editable} />
      ))}
    </ul>
  );
}
