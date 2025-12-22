import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../button";
import { Input } from "../input";

describe("Button accessibility", () => {
  it("derives aria-label from children when not provided", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-label")).toBe("Save");
  });

  it("ignores empty aria-label and derives from children", () => {
    render(<Button aria-label="">Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-label")).toBe("Save");
  });

  it("passes aria-describedby and disabled state", () => {
    render(
      <Button aria-describedby="button-hint" disabled>
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("aria-describedby")).toBe("button-hint");
    expect(button).toHaveProperty("disabled", true);
  });
});

describe("Input accessibility", () => {
  it("derives aria-label from placeholder when not provided", () => {
    render(<Input placeholder="Email address" />);

    const input = screen.getByRole("textbox", { name: "Email address" });
    expect(input.getAttribute("aria-label")).toBe("Email address");
  });

  it("ignores empty aria-label and falls back to placeholder", () => {
    render(<Input aria-label="" placeholder="Phone" />);

    const input = screen.getByRole("textbox", { name: "Phone" });
    expect(input.getAttribute("aria-label")).toBe("Phone");
  });

  it("passes aria-describedby and disabled state", () => {
    render(<Input aria-describedby="input-hint" disabled />);

    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-describedby")).toBe("input-hint");
    expect(input).toHaveProperty("disabled", true);
  });
});
