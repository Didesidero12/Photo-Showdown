"use client";

import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleSignOut = async () => {
    if (confirm("Warning: Since you don't use a password, you will need a Recovery Code from your teacher to access this work again on this device. Are you sure you want to sign out?")) {
      await supabase.auth.signOut();
      window.location.href = "/join";
    }
  };

  return (
    <button 
      onClick={handleSignOut}
      style={{
        background: 'transparent',
        border: '1px solid #ef4444',
        color: '#ef4444',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '0.875rem'
      }}
    >
      Sign Out / Leave Device
    </button>
  );
}
