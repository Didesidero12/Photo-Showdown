import { describe, test, expect } from "vitest";
import { validateServerCritique } from "@/lib/actions/critique";

describe("Critique Validation Logic", () => {
  test("Accepts valid, specific Notice and Effect", () => {
    const error = validateServerCritique(
      "The harsh diagonal shadow cutting across the background.",
      "It creates a strong sense of tension and draws the eye to the subject."
    );
    expect(error).toBeNull();
  });

  test("Rejects empty Notice with valid Effect", () => {
    const error = validateServerCritique(
      "   ",
      "It creates a strong sense of tension and draws the eye to the subject."
    );
    expect(error).toBe("missing_notice");
  });

  test("Rejects valid Notice with empty Effect", () => {
    const error = validateServerCritique(
      "The harsh diagonal shadow cutting across the background.",
      "short"
    );
    expect(error).toBe("missing_effect");
  });

  test("Rejects generic Notice with valid Effect", () => {
    const error = validateServerCritique(
      "It looks really good.",
      "It creates a strong sense of tension and draws the eye to the subject."
    );
    expect(error).toBe("generic_notice");
  });

  test("Rejects valid Notice with generic Effect", () => {
    const error = validateServerCritique(
      "The harsh diagonal shadow cutting across the background.",
      "This one is better."
    );
    expect(error).toBe("generic_effect");
  });

  test("Rejects repeated response (Notice equals Effect)", () => {
    const text = "The harsh diagonal shadow cutting across the background.";
    const error = validateServerCritique(text, text.toUpperCase());
    expect(error).toBe("repeated_response");
  });
});
