"use client";

import { useTransition, useState } from "react";
import { transitionSessionStatus } from "@/lib/actions/session";
import { useRouter } from "next/navigation";

export default function MonitorClient({ sessionId, currentStatus }: { sessionId: string, currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleReveal = () => {
    startTransition(async () => {
      const res = await transitionSessionStatus(sessionId, "reveal");
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const handleClose = () => {
    startTransition(async () => {
      const res = await transitionSessionStatus(sessionId, "closed");
      if (res.error) setError(res.error);
      else router.push("/classes");
    });
  };

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      {error && <span style={{ color: "red" }}>{error}</span>}
      {currentStatus === "active" && (
        <button 
          onClick={handleReveal} 
          disabled={isPending}
          style={{ padding: "0.5rem 1rem", background: "var(--secondary-color)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          {isPending ? "Revealing..." : "Reveal Results"}
        </button>
      )}
      <button 
        onClick={handleClose}
        disabled={isPending}
        style={{ padding: "0.5rem 1rem", background: "var(--background-alt)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer" }}
      >
        Close Session
      </button>
    </div>
  );
}
