import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSensor: () => ({}),
  useSensors: () => [],
  PointerSensor: class {},
  closestCenter: () => null,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
  }),
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const copy = items.slice();
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
  },
  verticalListSortingStrategy: () => null,
  horizontalListSortingStrategy: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
  },
}));

import InlineKeyboard from "../InlineKeyboard";
import { toast } from "sonner";
import type { KeyboardRow } from "@/types/telegram";

const makeRows = (count: number): KeyboardRow[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: `row-${idx + 1}`,
    buttons: [
      {
        id: `btn-${idx + 1}`,
        text: `Row ${idx + 1}`,
        callback_data: `cb-${idx + 1}`,
      },
    ],
  }));

describe("InlineKeyboard limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clamps rows to Telegram limits and shows a warning toast", async () => {
    render(
      <InlineKeyboard
        keyboard={makeRows(101)}
        onButtonTextChange={() => {}}
        onButtonUpdate={() => {}}
        onDeleteButton={() => {}}
      />
    );

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("最多 100 行"));
    });
    expect(screen.getByText(/最多 100 行按钮/)).toBeTruthy();
    expect(screen.getByText("Row 100")).toBeTruthy();
    expect(screen.queryByText("Row 101")).toBeNull();
  });

  it("clamps buttons per row to Telegram limits and shows a warning toast", async () => {
    const keyboard: KeyboardRow[] = [
      {
        id: "row-1",
        buttons: Array.from({ length: 9 }, (_, idx) => ({
          id: `btn-${idx + 1}`,
          text: `B${idx + 1}`,
          callback_data: `cb-${idx + 1}`,
        })),
      },
    ];

    render(
      <InlineKeyboard
        keyboard={keyboard}
        onButtonTextChange={() => {}}
        onButtonUpdate={() => {}}
        onDeleteButton={() => {}}
      />
    );

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("每行最多 8 个按钮"));
    });
    expect(
      screen.getByText("已超过 Telegram 限制：每行最多 8 个按钮，超出部分将被隐藏。")
    ).toBeTruthy();
    expect(screen.getByText("B8")).toBeTruthy();
    expect(screen.queryByText("B9")).toBeNull();
  });
});
