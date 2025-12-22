import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

describe("Select accessibility", () => {
  it("exposes aria-haspopup and toggles aria-expanded via keyboard", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Fruit">
          <SelectValue placeholder="Select fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not open when disabled", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Fruit" disabled>
          <SelectValue placeholder="Select fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveProperty("disabled", true);

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
