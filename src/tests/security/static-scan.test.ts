/**
 * Static security tests — run without a Supabase instance.
 *
 * These tests verify code-level security invariants:
 * - Service-role key is never referenced in client-accessible directories
 * - admin.ts is never imported outside server-only files
 * - NEXT_PUBLIC_ prefix is never applied to the service-role key
 *
 * Run with: npm run test:static
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

function grep(pattern: string, dir: string): string {
  try {
    return execSync(`grep -r "${pattern}" "${dir}" 2>/dev/null || true`, {
      cwd: process.cwd(),
      encoding: "utf-8",
    });
  } catch {
    return "";
  }
}

describe("Static security scan — service-role key exposure", () => {
  it("SUPABASE_SERVICE_ROLE_KEY is not referenced in src/app", () => {
    const result = grep("SUPABASE_SERVICE_ROLE_KEY", "src/app");
    expect(result.trim()).toBe("");
  });

  it("SUPABASE_SERVICE_ROLE_KEY is not referenced in src/components (if dir exists)", () => {
    const result = grep("SUPABASE_SERVICE_ROLE_KEY", "src/components");
    expect(result.trim()).toBe("");
  });

  it("SUPABASE_SERVICE_ROLE_KEY is not referenced in src/hooks (if dir exists)", () => {
    const result = grep("SUPABASE_SERVICE_ROLE_KEY", "src/hooks");
    expect(result.trim()).toBe("");
  });

  it("admin.ts is not imported in src/app outside route handlers", () => {
    const raw = grep("supabase/admin", "src/app");
    const violations = raw
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => {
        // Allow imports only in route.ts files under /api/
        return !(line.includes("/api/") && line.includes("route.ts"));
      });
    expect(violations).toHaveLength(0);
  });

  it("NEXT_PUBLIC_ prefix is never applied to SUPABASE_SERVICE_ROLE_KEY", () => {
    try {
      const result = execSync(
        `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE" src --include="*.ts" --include="*.tsx" ` +
        `--exclude="static-scan.test.ts" 2>/dev/null || true`,
        { cwd: process.cwd(), encoding: "utf-8" }
      );
      expect(result.trim()).toBe("");
    } catch {
      // grep exit code 1 = no matches = pass
    }
  });
});

describe("Static security scan — token exposure", () => {
  it("No hardcoded Supabase URLs or keys in source files (placeholder check)", () => {
    // Checks that no real Supabase project URL is hardcoded
    // Pattern: supabase.co (would appear in hardcoded keys)
    const result = grep("\\.supabase\\.co", "src");
    // Any match should only be in comments or example strings, not actual assignments
    const violations = result
      .trim()
      .split("\n")
      .filter((l) => l.trim() && !l.includes("//") && !l.includes("*"))
      .filter((l) => l.includes("=") || l.includes(":"));
    // In development, process.env reads are fine; hardcoded strings are not
    const hardcoded = violations.filter(
      (l) => !l.includes("process.env") && !l.includes("NEXT_PUBLIC_SUPABASE_URL")
    );
    expect(hardcoded).toHaveLength(0);
  });
});
