"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ListCandidate {
  id: string;
  firstName: string;
  lastName: string;
  rank: number;
}

interface PartyList {
  id: string;
  name: string;
  abbreviation: string;
  candidates: ListCandidate[];
}

interface Props {
  electionId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  seats: number;
  lists: PartyList[];
}

function CreateListForm({ electionId, seats }: { electionId: string; seats: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarning(null);

    const res = await fetch(`/api/admin/elections/${electionId}/party-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, abbreviation }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the list.");
      return;
    }

    const data = await res.json();
    setName("");
    setAbbreviation("");
    if (data.warning) setWarning(data.warning);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <label>
        List name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Abbreviation
        <input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add list"}
      </button>
      {warning && <p className="schedule-hint">{warning}</p>}
    </form>
  );
}

function AddListCandidateForm({ listId, seats, candidateCount }: { listId: string; seats: number; candidateCount: number }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setWarning(null);

    const res = await fetch(`/api/admin/party-lists/${listId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add candidate.");
      return;
    }

    const data = await res.json();
    setFirstName("");
    setLastName("");
    if (data.warning) setWarning(data.warning);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form list-candidate-form">
      <label>
        First name
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </label>
      <label>
        Last name
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add candidate"}
      </button>
      {(warning || candidateCount < seats) && (
        <p className="schedule-hint">{warning ?? `This list has ${candidateCount} candidate(s), fewer than the ${seats} total seat(s).`}</p>
      )}
    </form>
  );
}

export function PartyListManager({ electionId, status, seats, lists }: Props) {
  return (
    <div className="party-list-manager">
      {lists.map((list) => (
        <div key={list.id} className="party-list-card">
          <h3>
            {list.name} ({list.abbreviation})
          </h3>
          <ol>
            {list.candidates.map((c) => (
              <li key={c.id}>
                {c.firstName} {c.lastName}
              </li>
            ))}
          </ol>
          {status === "DRAFT" && <AddListCandidateForm listId={list.id} seats={seats} candidateCount={list.candidates.length} />}
        </div>
      ))}
      {status === "DRAFT" && <CreateListForm electionId={electionId} seats={seats} />}
    </div>
  );
}
