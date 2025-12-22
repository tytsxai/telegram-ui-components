import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomPanel } from "../BottomPanel";

const buildPendingItem = (id: string) => ({
  id,
  kind: "save",
  attempts: 1,
  lastError: null,
  lastAttemptAt: Date.now(),
  createdAt: Date.now(),
});

const baseProps = {
  editableJSON: "",
  onEditableJSONChange: () => {},
  onApplyJSON: () => {},
  jsonSyncError: null,
  isImporting: false,
  loadIssue: null,
  circularReferences: [],
  allowCircular: false,
  pendingOpsNotice: true,
  pendingQueueSize: 0,
  onRetryPendingOps: () => {},
  onClearPendingOps: () => {},
  onExportPending: () => {},
  retryingQueue: false,
  isOffline: false,
  codegenFramework: "telegraf" as const,
  onCodegenFrameworkChange: () => {},
  codegenOutput: "",
  onCopyCodegen: () => {},
};

describe("BottomPanel pending list", () => {
  it("virtualizes long pending list", () => {
    const items = Array.from({ length: 80 }, (_, i) => buildPendingItem(`id-${i}`));
    render(<BottomPanel {...baseProps} pendingItems={items} />);

    expect(screen.getByTestId("pending-item-id-0")).toBeTruthy();
    expect(screen.queryByTestId("pending-item-id-79")).toBeNull();

    const viewport = screen.getByTestId("pending-items-viewport");
    fireEvent.scroll(viewport, { target: { scrollTop: 9999 } });

    expect(screen.getByTestId("pending-item-id-79")).toBeTruthy();
  });

  it("renders full list when items are few", () => {
    const items = ["a", "b", "c"].map((id) => buildPendingItem(id));
    render(<BottomPanel {...baseProps} pendingItems={items} />);

    expect(screen.getByTestId("pending-item-a")).toBeTruthy();
    expect(screen.getByTestId("pending-item-b")).toBeTruthy();
    expect(screen.getByTestId("pending-item-c")).toBeTruthy();
  });
});
