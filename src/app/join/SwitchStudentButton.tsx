"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SwitchStudentButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = () => {
    startTransition(async () => {
      // Sign out completely clears the Supabase cookie
      await supabase.auth.signOut();
      // Hard redirect to clear any React memory / cache states
      window.location.href = "/join";
    });
  };

  return (
    <button
      onClick={handleSwitch}
      disabled={isPending}
      className={className}
      style={{
        background: "transparent",
        color: "var(--text-muted)",
        border: "1px solid var(--border-color)",
        padding: "0.5rem 1rem",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "0.9rem",
        opacity: isPending ? 0.5 : 1
      }}
    >
      {isPending ? "Switching..." : "This Isn't Me — Switch Student"}
    </button>
  );
}
