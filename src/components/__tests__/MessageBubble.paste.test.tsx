import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MessageBubble from "../MessageBubble";

describe("MessageBubble paste", () => {
  it("calls onChange with normalized text on paste and does not parse HTML tags", async () => {
    const onChange = vi.fn();
    const { getByRole } = render(<MessageBubble content="" onContentChange={onChange} />);
    const textbox = getByRole("textbox");

    fireEvent.paste(textbox, {
      clipboardData: {
        getData: vi.fn(() => "<b>x</b>\nline2"),
      },
    } as unknown as ClipboardEvent);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const result = onChange.mock.calls[0][0] as string;
    expect(result).not.toContain("<strong>");
  });
});

