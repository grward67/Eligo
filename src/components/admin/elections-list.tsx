"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ElectionSummary {
  id: string;
  title: string;
  status: string;
}

export function ElectionsList({ elections }: { elections: ElectionSummary[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected election(s)? This cannot be undone.`)) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/elections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ electionIds: Array.from(selected) }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete the selected election(s).");
      return;
    }

    const data: { deletedIds: string[]; blocked: { id: string; title: string }[] } = await res.json();

    if (data.blocked.length > 0) {
      const names = data.blocked.map((b) => `"${b.title}"`).join(", ");
      setError(
        `${names} ${data.blocked.length === 1 ? "is" : "are"} still running and ${
          data.blocked.length === 1 ? "was" : "were"
        } not deleted. Stop the election before deleting it.`
      );
    } else {
      setError(null);
    }

    setSelected(new Set());
    router.refresh();
  }

  if (elections.length === 0) {
    return <p>No elections yet. Create one above.</p>;
  }

  return (
    <div>
      <ul className="election-list">
        {elections.map((e) => (
          <li key={e.id}>
            <input
              type="checkbox"
              checked={selected.has(e.id)}
              onChange={() => toggle(e.id)}
              aria-label={`Select ${e.title}`}
            />
            <Link href={`/admin/elections/${e.id}`}>{e.title}</Link>
            <span className={`status-badge status-${e.status.toLowerCase()}`}>{e.status}</span>
          </li>
        ))}
      </ul>

      {error && <p className="form-error">{error}</p>}

      <button type="button" onClick={handleDelete} disabled={selected.size === 0 || submitting} className="delete-selected-btn">
        {submitting ? "Deleting..." : `Delete selected (${selected.size})`}
      </button>
    </div>
  );
}
