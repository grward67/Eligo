"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CreateElectionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/elections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, seats }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create election.");
      return;
    }

    setTitle("");
    setSeats(1);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Election title" required />
      </label>
      <label>
        Seats
        <input
          type="number"
          min={1}
          value={seats}
          onChange={(e) => setSeats(parseInt(e.target.value, 10) || 1)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create election"}
      </button>
    </form>
  );
}
