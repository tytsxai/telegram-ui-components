import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidebarLeft } from "../SidebarLeft";
import type { ComponentProps } from "react";
import type { Screen } from "@/types/telegram";

const baseScreen: Screen = {
  id: "screen-1",
  name: "模版 A",
  message_content: "hello",
  keyboard: [],
};

const buildProps = (overrides?: Partial<ComponentProps<typeof SidebarLeft>>) => ({
  user: null,
  screens: [baseScreen],
  currentScreenId: undefined,
  entryScreenId: null,
  pinnedIds: [],
  isLoading: false,
  isClearingScreens: false,
  shareLoading: false,
  hasUnsavedChanges: false,
  isOffline: false,
  onLogout: vi.fn(),
  onLoadScreen: vi.fn(),
  onNewScreen: vi.fn(),
  onSaveScreen: vi.fn(),
  onUpdateScreen: vi.fn(),
  onDeleteScreen: vi.fn(),
  onDeleteAllScreens: vi.fn(),
  onTogglePin: vi.fn(),
  onSetEntry: vi.fn(),
  onJumpToEntry: vi.fn(),
  onCopyOrShare: vi.fn(),
  onRotateShareLink: vi.fn(),
  onUnshareScreen: vi.fn(),
  onOpenImport: vi.fn(),
  onCopyJSON: vi.fn(),
  onExportJSON: vi.fn(),
  onExportFlow: vi.fn(),
  onOpenFlowDiagram: vi.fn(),
  ...overrides,
});

describe("SidebarLeft", () => {
  it("triggers save when no current screen", () => {
    const props = buildProps();
    render(<SidebarLeft {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "保存新模版" }));
    expect(props.onSaveScreen).toHaveBeenCalledTimes(1);
    expect(props.onUpdateScreen).not.toHaveBeenCalled();
  });

  it("triggers update when current screen exists", () => {
    const props = buildProps({ currentScreenId: baseScreen.id });
    render(<SidebarLeft {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(props.onUpdateScreen).toHaveBeenCalledTimes(1);
    expect(props.onSaveScreen).not.toHaveBeenCalled();
  });
});
