"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

interface LookupResult {
  found: boolean;
  electionId?: string;
  electionTitle?: string;
  label?: string | null;
  maxUses?: number | null;
  useCount?: number;
  active?: boolean;
  expiresAt?: string | null;
  createdAt?: string;
  hasVoted?: boolean;
  votedAt?: string | null;
}

export function CodeLookupForm() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/codes/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not look up that code.");
      return;
    }

    setResult(await res.json());
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="inline-form">
        <label>
          Access code
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting || code.trim().length === 0}>
          {submitting ? "Looking up..." : "Look up"}
        </button>
      </form>

      {result && !result.found && <p>No code matches that value.</p>}

      {result?.found && (
        <table className="codes-table">
          <tbody>
            <tr>
              <td>Election</td>
              <td>
                <Link href={`/admin/elections/${result.electionId}`}>{result.electionTitle}</Link>
              </td>
            </tr>
            <tr>
              <td>Label</td>
              <td>{result.label ?? "—"}</td>
            </tr>
            <tr>
              <td>Status</td>
              <td>{result.active ? "Active" : result.hasVoted ? "Voted" : "Revoked"}</td>
            </tr>
            <tr>
              <td>Has this code voted?</td>
              <td>
                {result.hasVoted
                  ? `Yes${result.votedAt ? `, at ${new Date(result.votedAt).toLocaleString()}` : ""}`
                  : "No"}
              </td>
            </tr>
            <tr>
              <td>Login attempts</td>
              <td>
                {result.useCount}
                {result.maxUses !== null ? ` / ${result.maxUses}` : " (unlimited)"}
              </td>
            </tr>
            <tr>
              <td>Expires</td>
              <td>{result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <td>Created</td>
              <td>{result.createdAt ? new Date(result.createdAt).toLocaleString() : "—"}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
