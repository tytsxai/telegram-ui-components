import { describe, it, expect } from "vitest";
import { createDefaultKeyboard, cloneKeyboard, safeKeyboard, keyboardIdHelpers } from "@/lib/keyboard/factory";

describe("keyboard factory", () => {
  it("creates a default keyboard with two buttons", () => {
    const kbd = createDefaultKeyboard();
    expect(kbd).toHaveLength(1);
    expect(kbd[0].buttons).toHaveLength(2);
  });

  it("cloneKeyboard returns a deep copy", () => {
    const original = createDefaultKeyboard();
    const copy = cloneKeyboard(original);
    expect(copy).not.toBe(original);
    expect(copy[0]).not.toBe(original[0]);
    copy[0].buttons[0].text = "changed";
    expect(original[0].buttons[0].text).not.toBe("changed");
  });

  it("safeKeyboard falls back to default and clones input", () => {
    const fallback = safeKeyboard();
    expect(fallback[0].buttons).toHaveLength(2);

    const given = createDefaultKeyboard();
    const safe = safeKeyboard(given);
    expect(safe).not.toBe(given);
    safe[0].buttons[0].text = "mutate";
    expect(given[0].buttons[0].text).not.toBe("mutate");
  });

  it("keyboardIdHelpers.newId yields unique-ish ids", () => {
    const a = keyboardIdHelpers.newId();
    const b = keyboardIdHelpers.newId();
    expect(a).not.toBe(b);
  });
});

