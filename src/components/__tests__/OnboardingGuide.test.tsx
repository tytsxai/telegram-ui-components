import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import OnboardingGuide from "../OnboardingGuide";

describe("OnboardingGuide", () => {
  const storageKey = "telegram_ui_onboarding_done_v1_test";

  beforeEach(() => {
    localStorage.clear();
  });

  it("persists dismissal to localStorage", () => {
    const Wrapper = () => (
      <OnboardingGuide
        visible
        progress={{ template: false, preview: false, share: false }}
        onDismiss={() => {
          localStorage.setItem(storageKey, "1");
        }}
        onOpenTemplate={() => void 0}
        onTogglePreview={() => void 0}
        onShare={() => void 0}
      />
    );

    render(<Wrapper />);
    fireEvent.click(screen.getByText("跳过引导"));
    expect(localStorage.getItem(storageKey)).toBe("1");
  });

  it("reflects progress count", () => {
    render(
      <OnboardingGuide
        visible
        progress={{ template: true, preview: true, share: false }}
        onDismiss={() => void 0}
        onOpenTemplate={() => void 0}
        onTogglePreview={() => void 0}
        onShare={() => void 0}
      />
    );
    expect(screen.getByText("2/3 完成")).toBeTruthy();
  });

  it("sets dialog semantics and responds to Escape", () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingGuide
        visible
        progress={{ template: false, preview: false, share: false }}
        onDismiss={onDismiss}
        onOpenTemplate={() => void 0}
        onTogglePreview={() => void 0}
        onShare={() => void 0}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "一次性引导" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cycles focus with Tab and Shift+Tab", () => {
    render(
      <OnboardingGuide
        visible
        progress={{ template: false, preview: false, share: false }}
        onDismiss={() => void 0}
        onOpenTemplate={() => void 0}
        onTogglePreview={() => void 0}
        onShare={() => void 0}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "一次性引导" });
    const buttons = screen.getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
