"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeCodeButton({ codeId }: { codeId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!confirm("Revoke this code? It can no longer be used to verify.")) return;
    setSubmitting(true);
    await fetch(`/api/admin/codes/${codeId}/revoke`, { method: "POST" });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} disabled={submitting}>
      {submitting ? "Revoking..." : "Revoke"}
    </button>
  );
}
