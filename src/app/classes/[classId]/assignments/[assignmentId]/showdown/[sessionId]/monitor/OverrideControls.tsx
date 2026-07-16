"use client";

import { useState, useTransition } from "react";
import { grantOverride, revokeOverride } from "@/lib/actions/session";

interface Student {
  id: string; // class_membership_id
  name: string;
  hasOverride: boolean;
}

export function OverrideControls({ sessionId, students }: { sessionId: string, students: Student[] }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (studentId: string, currentlyHasOverride: boolean) => {
    startTransition(async () => {
      if (currentlyHasOverride) {
        await revokeOverride(sessionId, studentId);
      } else {
        await grantOverride(sessionId, studentId, "Teacher Override");
      }
    });
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2>Give-to-Get Overrides</h2>
      <p style={{ marginBottom: "1rem", color: "var(--text-muted)" }}>
        Granting an override unlocks the Results Reveal for a student even if they have not completed the required critiques.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {students.map(s => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
            <span>{s.name}</span>
            <button 
              onClick={() => handleToggle(s.id, s.hasOverride)}
              disabled={isPending}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                background: s.hasOverride ? "var(--error-color, #e74c3c)" : "var(--primary-color)",
                color: "white"
              }}
            >
              {s.hasOverride ? "Revoke Override" : "Grant Override"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
