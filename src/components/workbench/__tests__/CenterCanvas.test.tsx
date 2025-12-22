import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import CenterCanvas from "../CenterCanvas";

const makeProps = () => ({
  messageContent: "Hello",
  setMessageContent: vi.fn(),
  keyboard: [],
  parseMode: "HTML" as const,
  onParseModeChange: vi.fn(),
  messageType: "text" as const,
  mediaUrl: "",
  onMessageTypeChange: vi.fn(),
  onMediaUrlChange: vi.fn(),
  onButtonTextChange: vi.fn(),
  onButtonUpdate: vi.fn(),
  onDeleteButton: vi.fn(),
  onButtonClick: vi.fn(),
  onKeyboardReorder: vi.fn(),
  isPreviewMode: false,
  onToggleMode: vi.fn(),
  onOpenTemplateLibrary: vi.fn(),
  canUndo: false,
  canRedo: false,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  messageBubbleRef: React.createRef(),
  screens: [],
  navigationHistory: [],
  currentScreenId: undefined,
  onNavigateBack: vi.fn(),
  currentScreenName: "",
  entryScreenId: null,
  hasUnsavedChanges: false,
  isOffline: false,
  shareSyncStatus: undefined,
  layoutSyncStatus: undefined,
  pendingQueueSize: 0,
  onOpenFlowDiagram: undefined,
});

describe("CenterCanvas", () => {
  const addMediaListener = vi.fn();
  const removeMediaListener = vi.fn();
  const matchMediaMock = vi.fn(() => ({
    matches: false,
    addEventListener: addMediaListener,
    removeEventListener: removeMediaListener,
  }));
  let originalAbortController: typeof AbortController;
  let abortSpy: ReturnType<typeof vi.spyOn>;
  let addWindowListener: ReturnType<typeof vi.spyOn>;
  let removeWindowListener: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addMediaListener.mockClear();
    removeMediaListener.mockClear();
    matchMediaMock.mockClear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    });
    originalAbortController = globalThis.AbortController;
    abortSpy = vi.spyOn(originalAbortController.prototype, "abort");
    addWindowListener = vi.spyOn(window, "addEventListener");
    removeWindowListener = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    abortSpy.mockRestore();
    globalThis.AbortController = originalAbortController;
    addWindowListener.mockRestore();
    removeWindowListener.mockRestore();
  });

  it("cleans up theme listeners on unmount", () => {
    const { unmount } = render(<CenterCanvas {...makeProps()} />);

    const addStorageCall = addWindowListener.mock.calls.find((call) => call[0] === "storage");
    const addedMediaHandler = addMediaListener.mock.calls[0]?.[1];
    const addedStorageHandler = addStorageCall?.[1];

    expect(addMediaListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(addWindowListener).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(Object) }),
    );

    unmount();

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(removeMediaListener).toHaveBeenCalledWith("change", addedMediaHandler);
    expect(removeWindowListener).toHaveBeenCalledWith("storage", addedStorageHandler);
  });
});
