import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import MessageBubble from "../MessageBubble";

describe("MessageBubble truncate", () => {
  it("shows truncated content with expand/collapse toggle", () => {
    const longText = "a".repeat(600);
    const { getByRole } = render(<MessageBubble content={longText} readOnly />);
    const textbox = getByRole("textbox");

    expect(textbox.textContent).toBe(`${"a".repeat(500)}...`);
    const expandButton = getByRole("button", { name: "展开" });
    fireEvent.click(expandButton);

    expect(textbox.textContent).toBe(longText);
    const collapseButton = getByRole("button", { name: "收起" });
    fireEvent.click(collapseButton);
    expect(textbox.textContent).toBe(`${"a".repeat(500)}...`);
  });

  it("handles empty content without truncation", () => {
    const { getByRole, queryByRole } = render(<MessageBubble content="" readOnly />);
    const textbox = getByRole("textbox");

    expect(textbox.textContent).toBe("");
    expect(queryByRole("button", { name: "展开" })).toBeNull();
  });

  it("truncates by Unicode code points", () => {
    const longEmojiText = "😀".repeat(501);
    const { getByRole } = render(<MessageBubble content={longEmojiText} readOnly />);
    const textbox = getByRole("textbox");

    expect(textbox.textContent).toBe(`${"😀".repeat(500)}...`);
  });
});
