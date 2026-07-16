"use client";

import { useTransition, useState } from "react";
import { toggleCritiqueHidden } from "@/lib/actions/session";

export function HideCritiqueButton({ critiqueId, initialHidden }: { critiqueId: string; initialHidden: boolean }) {
  const [isHidden, setIsHidden] = useState(initialHidden);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const newValue = !isHidden;
    let reason = undefined;

    if (newValue) {
      reason = window.prompt("Reason for hiding this critique:");
      if (reason === null) return; // User cancelled
      if (reason.trim() === "") {
        alert("A reason is required to hide feedback.");
        return;
      }
    }

    setIsHidden(newValue); // Optimistic UI
    startTransition(async () => {
      const res = await toggleCritiqueHidden(critiqueId, newValue, reason);
      if (res.error) {
        // Revert on error
        setIsHidden(!newValue);
        alert(`Failed to update moderation status: ${res.error}`);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      style={{
        padding: "0.25rem 0.75rem",
        fontSize: "0.9rem",
        background: isHidden ? "transparent" : "var(--background-alt)",
        color: isHidden ? "var(--text-muted)" : "var(--error-color)",
        border: `1px solid ${isHidden ? "var(--border-color)" : "var(--error-color)"}`,
        borderRadius: "4px",
        cursor: isPending ? "not-allowed" : "pointer",
        opacity: isPending ? 0.5 : 1
      }}
    >
      {isHidden ? "Hidden" : "Hide Feedback"}
    </button>
  );
}
