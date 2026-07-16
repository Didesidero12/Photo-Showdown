"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./recover.module.css";

export default function RecoverPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === "rate_limited") {
          setError("Too many attempts. Please try again later.");
        } else if (data.error === "invalid_format") {
          setError("Invalid code format. It should look like A8B2-9F3C.");
        } else if (data.error === "invalid_code") {
          setError("Invalid or expired recovery code.");
        } else if (data.error === "conflict_existing_membership") {
          setError("You already have a different membership for this class on this device. Ask your teacher for help.");
        } else if (data.error === "teacher_account") {
          setError("You are signed in as a teacher. Sign out first to recover a student membership.");
        } else {
          setError("Failed to recover access.");
        }
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Access Restored</h1>
          <p className={styles.successMessage}>
            You have recovered access to your class. If you are enrolled in other classes, ask those teachers for their recovery codes to restore access on this device.
          </p>
          <button 
            className={styles.submitBtn} 
            onClick={() => router.push("/my")}
          >
            Continue to My Classes
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Recover Access</h1>
        <p className={styles.subtitle}>
          Enter the recovery code provided by your teacher to restore access to your class on this device.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error} role="alert">{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="recoveryCode" className={styles.label}>Recovery Code</label>
            <input
              id="recoveryCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A8B2-9F3C"
              className={styles.input}
              required
              disabled={loading}
              maxLength={9}
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading || code.length < 8}
          >
            {loading ? "Recovering..." : "Recover Access"}
          </button>
        </form>
        
        <div className={styles.footer}>
          <a href="/join" className={styles.link}>Or join a new class</a>
        </div>
      </div>
    </main>
  );
}
