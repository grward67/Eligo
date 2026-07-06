"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CodeEntryForm({ electionId }: { electionId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/voter/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionId, code }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "That code isn't valid. Please check it and try again.");
      return;
    }

    router.push(`/vote/${electionId}/ballot`);
  }

  return (
    <form onSubmit={handleSubmit} className="code-form">
      <label>
        Access code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXXX-XXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting || code.trim().length === 0}>
        {submitting ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
