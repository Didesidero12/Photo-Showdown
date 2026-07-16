"use client";

import { useRouter } from "next/navigation";

interface Props {
  statusText?: string;
}

export function WaitingRoom({ statusText = "You've completed your critique! The teacher is reviewing and will unlock results soon." }: Props) {
  const router = useRouter();

  return (
    <div style={{ maxWidth: "600px", margin: "4rem auto", padding: "2rem", textAlign: "center", background: "var(--background-alt)", borderRadius: "12px", border: "1px solid var(--border-color)", color: "var(--text-color)" }}>
      <h1 style={{ marginBottom: "1rem", fontSize: "2rem" }}>Hang Tight! ⏱️</h1>
      <p style={{ fontSize: "1.2rem", color: "var(--text-muted)", marginBottom: "2rem" }}>
        {statusText}
      </p>
      
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", background: "var(--background)", color: "var(--text-color)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer" }}
        >
          Check for Updates
        </button>
        <button 
          onClick={() => router.push('/my')}
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", background: "var(--primary-color)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
