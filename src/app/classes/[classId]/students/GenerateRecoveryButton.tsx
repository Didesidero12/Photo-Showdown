"use client";

import { useState } from "react";
import { generateRecoveryCode } from "@/lib/actions/recovery";

export function GenerateRecoveryButton({ 
  classMembershipId, 
  studentName 
}: { 
  classMembershipId: string, 
  studentName: string 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!confirm(`Are you sure you want to generate a recovery code for ${studentName}? Existing codes will not be invalidated until expiration, but they should only need one.`)) {
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setRecoveryCode(null);
    
    try {
      const result = await generateRecoveryCode(classMembershipId);
      setRecoveryCode(result.code);
    } catch (err: any) {
      setError(err.message || "Failed to generate code.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (recoveryCode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <strong style={{ fontFamily: 'monospace', letterSpacing: '2px', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px' }}>
          {recoveryCode}
        </strong>
        <span style={{ fontSize: '0.8rem', color: '#666' }}>Give this code to {studentName}. Expires in 30m.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button 
        onClick={handleGenerate} 
        disabled={isGenerating}
        style={{
          background: 'none',
          border: '1px solid #d1d5db',
          padding: '6px 12px',
          borderRadius: '6px',
          cursor: isGenerating ? 'wait' : 'pointer',
          fontSize: '0.85rem',
          color: '#374151',
          width: 'fit-content'
        }}
      >
        {isGenerating ? "Generating..." : "Generate Recovery Code"}
      </button>
      {error && <span style={{ color: 'red', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
}
