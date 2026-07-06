"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CandidateForm({ electionId }: { electionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [party, setParty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/elections/${electionId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, party: party || null }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add candidate.");
      return;
    }

    setName("");
    setParty("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Party (optional)
        <input value={party} onChange={(e) => setParty(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add candidate"}
      </button>
    </form>
  );
}
