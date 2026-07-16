/**
 * Client component — QR code display for assignment share URL.
 * Uses the `qrcode` package (already in dependencies) via canvas.
 */
"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import styles from "./assignment-detail.module.css";

export function QRCodeSection({ shareUrl }: { shareUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, shareUrl, {
        width: 180,
        margin: 2,
        color: { dark: "#f0f0f4", light: "#1a1a2e" },
      }).catch(console.error);
    }
  }, [shareUrl]);

  return (
    <div className={styles.qrWrapper}>
      <canvas
        ref={canvasRef}
        aria-label="QR code for assignment share URL"
        id="assignment-qr-code"
      />
      <p className={styles.qrHint}>Scan to open assignment</p>
    </div>
  );
}
