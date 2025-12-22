import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

describe("Dialog accessibility", () => {
  it("adds dialog role, aria-modal, and default aria-label", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("Dialog");
  });

  it("prefers aria-labelledby when provided and ignores empty aria-label", () => {
    render(
      <Dialog open>
        <DialogContent aria-label="" aria-labelledby="dialog-title">
          <DialogTitle id="dialog-title">Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBeNull();
    expect(dialog.getAttribute("aria-labelledby")).toBe("dialog-title");
  });
});
