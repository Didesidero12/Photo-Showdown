import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Photo Showdown",
    template: "%s | Photo Showdown",
  },
  description:
    "A cinematic classroom photography critique platform. Submit, critique, reveal, reflect.",
  robots: { index: false, follow: false }, // Private classroom tool — not for public indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
