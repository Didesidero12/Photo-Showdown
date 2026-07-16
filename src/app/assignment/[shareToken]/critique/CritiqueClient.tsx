"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCritique } from "@/lib/actions/critique";

interface SubmissionInfo {
  id: string;
  url: string;
  intent: string;
}

interface CritiqueClientProps {
  matchupId: string;
  submissionA: SubmissionInfo;
  submissionB: SubmissionInfo;
}

export default function CritiqueClient({ matchupId, submissionA, submissionB }: CritiqueClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [effect, setEffect] = useState("");
  const [lensType, setLensType] = useState("lighting"); // Default, could be passed from assignment
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleSelect = (id: string) => {
    if (isRevealed) return; // Cannot change selection after reveal
    setSelectedId(id);
  };

  const validateCritique = (noticeText: string, effectText: string) => {
    if (noticeText.trim().length < 10) return "missing_notice";
    if (effectText.trim().length < 10) return "missing_effect";
    
    if (noticeText.trim().toLowerCase() === effectText.trim().toLowerCase()) {
      return "repeated_response";
    }

    const combined = noticeText + " " + effectText;
    const vagueWords = ["good", "nice", "cool", "pretty", "better"];
    const words = combined.toLowerCase().split(/\s+/);
    const nonVagueCount = words.filter(w => !vagueWords.includes(w)).length;
    
    if (nonVagueCount < 3) {
      return "generic_notice";
    }
    return null;
  };

  const getCoachingMessage = (code: string) => {
    switch (code) {
      case "missing_notice":
      case "too_short":
        return "Coach: Name one specific part of the photograph that influenced your choice.";
      case "generic_notice":
      case "generic_effect":
      case "generic_praise":
        return "Coach: Avoid words like ‘good’ or ‘nice.’ What exactly did you notice in the lighting, composition, color, timing, technique, or story?";
      case "missing_effect":
        return "Coach: You identified a visual choice. Now explain what it did to the mood, viewer attention, story, or strength of the photograph.";
      case "repeated_response":
        return "Coach: Your Effect should be different from your Notice. Explain the *impact* of what you noticed.";
      default:
        return code;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedId) {
      setError("Please select an image first.");
      return;
    }

    const validationError = validateCritique(notice, effect);
    if (validationError) {
      setError(getCoachingMessage(validationError));
      return;
    }

    startTransition(async () => {
      const res = await submitCritique(matchupId, selectedId, notice.trim(), effect.trim(), lensType);
      if (res.error) {
        setError(getCoachingMessage(res.error));
      } else {
        setIsRevealed(true);
      }
    });
  };

  if (isRevealed) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", color: "var(--text-color)" }}>
        <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Reveal Phase</h1>
        <p style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.2rem" }}>
          You chose Image {selectedId === submissionA.id ? "A" : "B"}. Compare your interpretation with the creators' actual intent below!
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <div style={{ padding: "1rem", border: selectedId === submissionA.id ? "2px solid var(--primary-color)" : "1px solid var(--border-color)", borderRadius: "8px" }}>
            <img src={submissionA.url} alt="Image A" style={{ width: "100%", height: "auto", borderRadius: "8px" }} />
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-alt)", borderRadius: "8px" }}>
              <h3>Creator's Intent</h3>
              <p>{submissionA.intent}</p>
            </div>
          </div>
          <div style={{ padding: "1rem", border: selectedId === submissionB.id ? "2px solid var(--primary-color)" : "1px solid var(--border-color)", borderRadius: "8px" }}>
            <img src={submissionB.url} alt="Image B" style={{ width: "100%", height: "auto", borderRadius: "8px" }} />
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--background-alt)", borderRadius: "8px" }}>
              <h3>Creator's Intent</h3>
              <p>{submissionB.intent}</p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <button 
            onClick={() => router.push('/my')}
            style={{ padding: "1rem 2rem", fontSize: "1.1rem", background: "var(--primary-color)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", color: "var(--text-color)" }}>
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1>Quick Showdown</h1>
        <p style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          Lens: <strong>Lighting</strong>
        </p>
        <p>Which image uses lighting more intentionally? Select the strongest image and provide visual evidence.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        <button 
          onClick={() => handleSelect(submissionA.id)}
          style={{
            padding: "0", border: selectedId === submissionA.id ? "4px solid var(--primary-color)" : "4px solid transparent",
            borderRadius: "12px", background: "transparent", cursor: "pointer", transition: "all 0.2s"
          }}
        >
          <img src={submissionA.url} alt="Image A" style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block" }} />
        </button>
        <button 
          onClick={() => handleSelect(submissionB.id)}
          style={{
            padding: "0", border: selectedId === submissionB.id ? "4px solid var(--primary-color)" : "4px solid transparent",
            borderRadius: "12px", background: "transparent", cursor: "pointer", transition: "all 0.2s"
          }}
        >
          <img src={submissionB.url} alt="Image B" style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block" }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: "800px", margin: "0 auto", background: "var(--background-alt)", padding: "2rem", borderRadius: "12px" }}>
        <h3 style={{ marginBottom: "1rem" }}>Provide Visual Evidence</h3>
        {error && (
          <div style={{
            color: error.startsWith("Coach:") ? "var(--warning-color)" : "var(--error-color)",
            marginBottom: "1rem", padding: "1rem",
            background: error.startsWith("Coach:") ? "rgba(255,165,0,0.1)" : "rgba(255,0,0,0.1)",
            border: `1px solid ${error.startsWith("Coach:") ? "var(--warning-color)" : "transparent"}`,
            borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center"
          }}>
            {error.startsWith("Coach:") && <strong>💡</strong>}
            {error}
          </div>
        )}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            Notice
          </label>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>What specific visual choice influenced your decision?</p>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            placeholder="e.g. the harsh diagonal shadow cutting across the background..."
            rows={2}
            disabled={!selectedId || isPending}
            style={{
              width: "100%", padding: "1rem", fontSize: "1rem", borderRadius: "8px",
              border: "1px solid var(--border-color)", background: "var(--background)", color: "var(--text-color)",
              fontFamily: "inherit"
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
            Effect
          </label>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>What effect did that choice have on the photograph, viewer attention, mood, story, or assignment goal?</p>
          <textarea
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            placeholder="e.g. it creates a strong sense of tension and draws the eye directly to the subject..."
            rows={3}
            disabled={!selectedId || isPending}
            style={{
              width: "100%", padding: "1rem", fontSize: "1rem", borderRadius: "8px",
              border: "1px solid var(--border-color)", background: "var(--background)", color: "var(--text-color)",
              fontFamily: "inherit"
            }}
          />
        </div>
        <div style={{ textAlign: "right" }}>
          <button 
            type="submit" 
            disabled={!selectedId || isPending}
            style={{
              padding: "1rem 2rem", fontSize: "1.1rem", background: "var(--primary-color)", color: "white", 
              border: "none", borderRadius: "8px", cursor: (!selectedId || isPending) ? "not-allowed" : "pointer",
              opacity: (!selectedId || isPending) ? 0.6 : 1
            }}
          >
            {isPending ? "Submitting..." : "Submit Critique to Reveal"}
          </button>
        </div>
      </form>
    </div>
  );
}
