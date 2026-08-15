"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;

export function ElectionStatusControl({ electionId, status }: { electionId: string; status: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string) {
    if (next === status) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/elections/${electionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not change the election status.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="inline-form">
      {STATUSES.map((s) => (
        <button key={s} type="button" disabled={submitting || s === status} onClick={() => setStatus(s)}>
          {s === status ? `${s} (current)` : `Set ${s}`}
        </button>
      ))}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
