import { renderHook, act } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { publishSyncEvent } from "@/lib/syncTelemetry";
import { useSupabaseSync } from "../useSupabaseSync";
import type { Screen } from "@/types/telegram";
import type { PendingItem, PendingFailure } from "@/lib/pendingQueue";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

const supabaseFrom = vi.hoisted(() => vi.fn());

const mockDataAccess = vi.hoisted(() => ({
  saveScreen: vi.fn(),
  updateScreen: vi.fn(),
  deleteScreens: vi.fn(),
  deleteLayouts: vi.fn(),
  upsertPins: vi.fn(),
  publishShareToken: vi.fn(),
  rotateShareToken: vi.fn(),
  revokeShareToken: vi.fn(),
}));

const baseScreen: Screen = {
  id: "screen-1",
  user_id: "user-1",
  name: "Main",
  message_content: "hello",
  keyboard: [],
};

const createDeferred = <T,>() => {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/syncTelemetry", () => ({ publishSyncEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: supabaseFrom },
}));
vi.mock("@/lib/runtimeConfig", () => ({ hasSupabaseEnv: () => true }));
vi.mock("@/lib/dataAccess", () => {
  const SupabaseDataAccess = vi.fn(function MockSupabaseDataAccess() {
    return mockDataAccess;
  });
  return { SupabaseDataAccess };
});

const mockUser = { id: "user-1" } as User;

// Silence noisy sync logs during tests while still allowing targeted assertions
const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

describe("useSupabaseSync", () => {
  beforeEach(() => {
    Object.values(mockDataAccess).forEach((fn) => fn.mockReset());
    vi.mocked(publishSyncEvent).mockReset();
    consoleInfoSpy.mockClear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();

    const screensChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [baseScreen], error: null }),
        }),
      }),
    };

    const pinsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { pinned_ids: ["screen-1"] }, error: null }),
        }),
      }),
    };

    supabaseFrom.mockReset();
    supabaseFrom.mockImplementation((table) => {
      if (table === "screens") return screensChain;
      if (table === "user_pins") return pinsChain;
      return { select: vi.fn() };
    });

    Object.values(toast).forEach((fn) => fn.mockReset());
  });

  afterAll(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const makePendingSave = (overrides: Partial<PendingItem> = {}): PendingItem => ({
    id: "pending-save",
    kind: "save",
    payload: {
      user_id: mockUser.id,
      name: "Mock",
      message_content: "m",
      keyboard: [],
      is_public: false,
    },
    createdAt: Date.now(),
    attempts: 0,
    ...overrides,
  });

  const makePendingUpdate = (overrides: Partial<PendingItem> = {}): PendingItem => ({
    id: "pending-update",
    kind: "update",
    payload: {
      id: "screen-1",
      update: { message_content: "m", keyboard: [] },
    },
    createdAt: Date.now(),
    attempts: 0,
    ...overrides,
  });

  it("loads screens and pinned ids for the current user", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await result.current.loadScreens();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.screens[0]).toMatchObject({ id: "screen-1", name: "Main" });
    expect(result.current.pinnedIds).toEqual(["screen-1"]);
    expect(result.current.shareSyncStatus.state).toBe("success");
  });

  it("logs retry telemetry when load screens retries", async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const screensChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn()
            .mockResolvedValueOnce({ data: null, error: { status: 500 } })
            .mockResolvedValueOnce({ data: [baseScreen], error: null }),
        }),
      }),
    };

    const pinsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { pinned_ids: [] }, error: null }),
        }),
      }),
    };

    supabaseFrom.mockImplementation((table) => {
      if (table === "screens") return screensChain;
      if (table === "user_pins") return pinsChain;
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      const pending = result.current.loadScreens();
      await vi.runAllTimersAsync();
      await pending;
    });

    const retryEvents = vi.mocked(publishSyncEvent).mock.calls
      .map(call => call[0])
      .filter((evt) => evt?.status?.message?.includes("load retry"));

    expect(retryEvents.length).toBeGreaterThan(0);

    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  it("logs pin fetch errors but still resolves load", async () => {
    supabaseFrom.mockImplementation((table) => {
      if (table === "screens") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [baseScreen], error: null }),
            }),
          }),
        };
      }
      if (table === "user_pins") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: "500", message: "boom" } }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    await act(async () => {
      await result.current.loadScreens();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error loading pins:", expect.anything());
  });

  it("sets share sync status to error when loading fails", async () => {
    supabaseFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error("load failed") }),
        }),
      }),
    }));

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await result.current.loadScreens();
    });

    expect(result.current.shareSyncStatus.state).toBe("error");
    expect(toast.error).toHaveBeenCalledWith("Failed to load screens");
  });

  it("saves a screen and appends it to state", async () => {
    const saved = { ...baseScreen, id: "screen-2", name: "Saved" };
    mockDataAccess.saveScreen.mockResolvedValue(saved);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await result.current.saveScreen({
        user_id: mockUser.id,
        name: "Saved",
        message_content: "content",
        keyboard: [],
        is_public: false,
      });
    });

    expect(mockDataAccess.saveScreen).toHaveBeenCalled();
    expect(result.current.screens).toEqual(expect.arrayContaining([saved as Screen]));
    expect(result.current.shareLoading).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Screen saved");
    expect(result.current.shareSyncStatus.state).toBe("success");
  });

  it("updates an existing screen in state", async () => {
    const updated = { ...baseScreen, id: "screen-1", message_content: "updated" };
    mockDataAccess.updateScreen.mockResolvedValue(updated);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "updated", keyboard: [], updated_at: new Date().toISOString() },
      });
    });

    expect(mockDataAccess.updateScreen).toHaveBeenCalledWith({
      screenId: "screen-1",
      update: expect.objectContaining({ message_content: "updated" }),
    });
    expect(result.current.screens[0].message_content).toBe("updated");
  });

  it("updates only the targeted screen on success", async () => {
    const updated = { ...baseScreen, id: "screen-1", message_content: "updated" };
    mockDataAccess.updateScreen.mockResolvedValue(updated);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen, { ...baseScreen, id: "screen-2", message_content: "keep" }]);
    });

    await act(async () => {
      await result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "updated", keyboard: [] },
      });
    });

    const first = result.current.screens.find((screen) => screen.id === "screen-1");
    const second = result.current.screens.find((screen) => screen.id === "screen-2");
    expect(first?.message_content).toBe("updated");
    expect(second?.message_content).toBe("keep");
  });

  it("ignores stale update responses when a newer update completes first", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    const firstCall = act(async () => {
      await result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    const secondCall = act(async () => {
      await result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    second.resolve({ ...baseScreen, message_content: "second" });
    await secondCall;

    first.resolve({ ...baseScreen, message_content: "first" });
    await firstCall;

    expect(result.current.screens[0].message_content).toBe("second");
  });

  it("keeps newer optimistic state when an older update succeeds first", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let firstPromise: Promise<Screen | null> | undefined;
    let secondPromise: Promise<Screen | null> | undefined;

    act(() => {
      firstPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    act(() => {
      secondPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    first.resolve({ ...baseScreen, message_content: "first" });
    await act(async () => {
      await firstPromise;
    });

    expect(result.current.screens[0].message_content).toBe("second");

    second.resolve({ ...baseScreen, message_content: "second" });
    await act(async () => {
      await secondPromise;
    });

    expect(result.current.screens[0].message_content).toBe("second");
  });

  it("rolls back optimistic updates when the latest update fails", async () => {
    mockDataAccess.updateScreen.mockRejectedValue(new Error("update failed"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen, { ...baseScreen, id: "screen-2", message_content: "other" }]);
    });

    await expect(
      act(async () => {
        await result.current.updateScreen({
          screenId: "screen-1",
          update: { message_content: "optimistic", keyboard: [] },
        });
      }),
    ).rejects.toThrow("update failed");

    const first = result.current.screens.find((screen) => screen.id === "screen-1");
    const second = result.current.screens.find((screen) => screen.id === "screen-2");
    expect(first?.message_content).toBe("hello");
    expect(second?.message_content).toBe("other");
  });

  it("does not rollback when an older update fails after a newer update starts", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let firstPromise: Promise<Screen | null> | undefined;
    let secondPromise: Promise<Screen | null> | undefined;

    act(() => {
      firstPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    act(() => {
      secondPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    first.reject(new Error("first failed"));
    await act(async () => {
      await expect(firstPromise).rejects.toThrow("first failed");
    });

    expect(result.current.screens[0].message_content).toBe("second");

    second.resolve({ ...baseScreen, message_content: "second" });
    await act(async () => {
      await secondPromise;
    });

    expect(result.current.screens[0].message_content).toBe("second");
  });

  it("does not rollback when an older update fails after a newer update succeeds", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let firstPromise: Promise<Screen | null> | undefined;
    let secondPromise: Promise<Screen | null> | undefined;

    act(() => {
      firstPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    act(() => {
      secondPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    second.resolve({ ...baseScreen, message_content: "second" });
    await act(async () => {
      await secondPromise;
    });

    first.reject(new Error("first failed"));
    await act(async () => {
      await expect(firstPromise).rejects.toThrow("first failed");
    });

    expect(result.current.screens[0].message_content).toBe("second");
  });

  it("rolls back to the original snapshot when multiple updates fail", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let firstPromise: Promise<Screen | null> | undefined;
    let secondPromise: Promise<Screen | null> | undefined;

    act(() => {
      firstPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    act(() => {
      secondPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    second.reject(new Error("second failed"));
    await act(async () => {
      await expect(secondPromise).rejects.toThrow("second failed");
    });

    expect(result.current.screens[0].message_content).toBe("first");

    first.reject(new Error("first failed"));
    await act(async () => {
      await expect(firstPromise).rejects.toThrow("first failed");
    });

    expect(result.current.screens[0].message_content).toBe("hello");
  });

  it("rolls back to the original snapshot when an older update fails first", async () => {
    const first = createDeferred<Screen>();
    const second = createDeferred<Screen>();
    mockDataAccess.updateScreen
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let firstPromise: Promise<Screen | null> | undefined;
    let secondPromise: Promise<Screen | null> | undefined;

    act(() => {
      firstPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "first", keyboard: [] },
      });
    });

    act(() => {
      secondPromise = result.current.updateScreen({
        screenId: "screen-1",
        update: { message_content: "second", keyboard: [] },
      });
    });

    first.reject(new Error("first failed"));
    await act(async () => {
      await expect(firstPromise).rejects.toThrow("first failed");
    });

    expect(result.current.screens[0].message_content).toBe("second");

    second.reject(new Error("second failed"));
    await act(async () => {
      await expect(secondPromise).rejects.toThrow("second failed");
    });

    expect(result.current.screens[0].message_content).toBe("hello");
  });

  it("surfaces errors when updating screens fails", async () => {
    mockDataAccess.updateScreen.mockRejectedValue(new Error("update boom"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await expect(
      act(async () => {
        await result.current.updateScreen({
          screenId: "screen-1",
          update: { message_content: "fail", keyboard: [] },
        });
      })
    ).rejects.toThrow("update boom");

    expect(toast.error).toHaveBeenCalledWith("Failed to update screen");
  });

  it("sets share status to error when saving fails", async () => {
    mockDataAccess.saveScreen.mockRejectedValue(new Error("fail to save"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await expect(
        result.current.saveScreen({
          user_id: mockUser.id,
          name: "Bad",
          message_content: "content",
          keyboard: [],
          is_public: false,
        })
      ).rejects.toThrow("fail to save");
    });

    expect(result.current.shareSyncStatus.state).toBe("error");
    expect(result.current.shareLoading).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Failed to save screen");
  });

  it("deletes a screen and updates local state", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteScreen("screen-1");
    });

    expect(mockDataAccess.deleteScreens).toHaveBeenCalledWith({ ids: ["screen-1"] });
    expect(result.current.screens).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith("Screen deleted");
  });

  it("handles bulk delete failures gracefully", async () => {
    mockDataAccess.deleteScreens.mockRejectedValue(new Error("bulk failed"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    expect(mockDataAccess.deleteScreens).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to delete all screens");
    expect(result.current.screens).toHaveLength(1);
  });

  it("logs error when deleting a single screen fails", async () => {
    mockDataAccess.deleteScreens.mockRejectedValue(new Error("delete failed"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteScreen("screen-1");
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to delete screen");
    expect(result.current.screens).toHaveLength(1);
  });

  it("deletes all screens and clears state", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    expect(mockDataAccess.deleteScreens).toHaveBeenCalledWith({ ids: ["screen-1"] });
    expect(result.current.screens).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith("All screens deleted");
  });

  it("cleans up layouts when deleteLayouts is available", async () => {
    mockDataAccess.deleteLayouts.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    expect(mockDataAccess.deleteLayouts).toHaveBeenCalledWith({ ids: ["screen-1"] });
  });

  it("skips layout cleanup when deleteLayouts is not a function", async () => {
    const original = mockDataAccess.deleteLayouts;
    (mockDataAccess as { deleteLayouts?: unknown }).deleteLayouts = undefined;

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    act(() => {
      result.current.setScreens([baseScreen]);
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    (mockDataAccess as { deleteLayouts?: unknown }).deleteLayouts = original;
  });

  it("skips delete when there are no screens to delete", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setScreens([]);
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    expect(mockDataAccess.deleteScreens).not.toHaveBeenCalled();
    expect(mockDataAccess.deleteLayouts).not.toHaveBeenCalled();
    expect(mockDataAccess.upsertPins).toHaveBeenCalledWith({ user_id: mockUser.id, pinned_ids: [] });
  });

  it("reverts pinned ids when upsert fails", async () => {
    mockDataAccess.upsertPins.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setPinnedIds([]);
    });

    await act(async () => {
      await result.current.handleTogglePin("screen-99");
    });

    expect(result.current.pinnedIds).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("Failed to update pins");
  });

  it("toggles pins and persists when upsert succeeds", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await result.current.loadScreens();
    });

    await act(async () => {
      result.current.setPinnedIds(["screen-1"]);
    });

    expect(result.current.pinnedIds).toEqual(["screen-1"]);

    await act(async () => {
      await result.current.handleTogglePin("screen-2");
    });

    expect(result.current.pinnedIds).toEqual(["screen-1", "screen-2"]);
    expect(mockDataAccess.upsertPins).toHaveBeenCalledWith({ user_id: mockUser.id, pinned_ids: ["screen-1", "screen-2"] });
  });

  it("removes pinned ids when toggled off", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setPinnedIds(["screen-1"]);
    });

    await act(async () => {
      await result.current.handleTogglePin("screen-1");
    });

    expect(result.current.pinnedIds).toEqual([]);
    expect(mockDataAccess.upsertPins).toHaveBeenCalledWith({ user_id: mockUser.id, pinned_ids: [] });
  });

  it("emits layout sync events with telemetry payload", () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));

    act(() => {
      result.current.setPendingQueueSize(2);
    });

    act(() => {
      result.current.logSyncEvent("layout", { state: "pending", requestId: "req-123", message: "layout sync" });
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "layout",
        status: expect.objectContaining({ state: "pending", requestId: "req-123", message: "layout sync" }),
        meta: expect.objectContaining({ userId: mockUser.id }),
      }),
    );
  });

  it("exposes queue replay callbacks that publish telemetry", () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    const failure: PendingFailure = { requestId: "req-queue", message: "network fail", at: Date.now() };
    const pendingItem = makePendingSave({
      id: "pending-1",
      attempts: 1,
      lastAttemptAt: failure.at,
      lastError: failure.message,
      failures: [failure],
    });

    act(() => {
      result.current.queueReplayCallbacks.onItemFailure?.(pendingItem, new Error("network"), { attempt: 2, delayMs: 50 });
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({
          state: "error",
          message: expect.stringContaining("retrying in 50ms"),
        }),
      }),
    );

    act(() => {
      result.current.queueReplayCallbacks.onSuccess?.(pendingItem);
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({ state: "success" }),
      }),
    );
  });

  it("publishes queue telemetry when no previous failures exist", () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    const pendingItem = makePendingSave({
      id: "pending-2",
      attempts: 0,
      lastAttemptAt: 123,
      failures: [],
    });

    act(() => {
      result.current.queueReplayCallbacks.onItemFailure?.(pendingItem, "offline", { attempt: 1 });
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({
          state: "error",
          message: expect.stringContaining("pending-2 replay failed (attempt 1): offline"),
        }),
      }),
    );

    act(() => {
      result.current.queueReplayCallbacks.onSuccess?.(pendingItem);
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({
          state: "success",
          requestId: expect.any(String),
        }),
      }),
    );
  });

  it("publishes queue retries without delay metadata", () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    const pending = makePendingUpdate({
      id: "pending-2",
      lastAttemptAt: Date.now(),
      failures: [],
    });
    act(() => {
      result.current.queueReplayCallbacks.onItemFailure?.(
        pending,
        new Error("transient"),
        { attempt: 1 }
      );
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({
          state: "error",
          message: expect.stringContaining("attempt 1"),
        }),
      }),
    );
  });

  it("defaults queue telemetry timestamps and omits retry delay copy when missing", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1234);
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    const pending = makePendingUpdate({
      id: "pending-4",
      attempts: 2,
      failures: [],
    });
    act(() => {
      result.current.queueReplayCallbacks.onItemFailure?.(
        pending,
        "offline",
        { attempt: 2 },
      );
    });

    const last = vi.mocked(publishSyncEvent).mock.calls.at(-1)?.[0];
    expect(last?.status?.at).toBe(1234);
    expect(String(last?.status?.message)).not.toContain("retrying in");
    nowSpy.mockRestore();
  });

  it("assigns request ids for queue success without prior failures", () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    const pending = makePendingSave({ id: "pending-3", failures: [] });
    act(() => {
      result.current.queueReplayCallbacks.onSuccess?.(
        pending,
      );
    });

    expect(publishSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "queue",
        status: expect.objectContaining({ requestId: expect.any(String), state: "success" }),
      }),
    );
  });

  it("falls back to default messages when errors are non-Error values", async () => {
    supabaseFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: "boom" }),
        }),
      }),
    }));

    const { result } = renderHook(() => useSupabaseSync(mockUser));
    await act(async () => {
      await result.current.loadScreens();
    });
    expect(result.current.shareSyncStatus.message).toBe("加载失败");

    mockDataAccess.saveScreen.mockRejectedValueOnce("bad save");
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.saveScreen({
          user_id: mockUser.id,
          name: "bad",
          message_content: "m",
          keyboard: [],
          is_public: false,
        });
      } catch (e) {
        caught = e;
      }
    });
    expect(caught).toEqual("bad save");
    expect(result.current.shareSyncStatus.message).toBe("保存失败");
  });

  it("uses fallback sync messages when update/delete operations fail with non-Error values", async () => {
    const { result } = renderHook(() => useSupabaseSync(mockUser));
    mockDataAccess.updateScreen.mockRejectedValueOnce("bad update");
    mockDataAccess.deleteScreens.mockRejectedValueOnce("bad delete").mockRejectedValueOnce("bulk fail");

    act(() => {
      result.current.setScreens([baseScreen]);
    });

    let updateError: unknown;
    await act(async () => {
      try {
        await result.current.updateScreen({ screenId: "screen-1", update: { message_content: "x", keyboard: [] } });
      } catch (e) {
        updateError = e;
      }
    });
    expect(updateError).toEqual("bad update");

    await act(async () => {
      await result.current.deleteScreen("screen-1");
    });

    await act(async () => {
      await result.current.deleteAllScreens();
    });

    const messages = vi.mocked(publishSyncEvent).mock.calls
      .map(call => call[0]?.status?.message)
      .filter((msg): msg is string => Boolean(msg));

    expect(messages).toEqual(expect.arrayContaining(["更新失败", "删除失败", "批量删除失败"]));
  });

  it("handles empty pin rows without crashing", async () => {
    const screensChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [baseScreen], error: null }),
        }),
      }),
    };

    const pinsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    };

    supabaseFrom.mockImplementation((table) => {
      if (table === "screens") return screensChain;
      if (table === "user_pins") return pinsChain;
      return { select: vi.fn() };
    });

    const { result } = renderHook(() => useSupabaseSync(mockUser));

    await act(async () => {
      await result.current.loadScreens();
    });

    expect(result.current.pinnedIds).toEqual([]);
  });

  it("no-ops when user is null", async () => {
    const { result } = renderHook(() => useSupabaseSync(null));

    await act(async () => {
      await result.current.loadScreens();
    });

    await act(async () => {
      const saved = await result.current.saveScreen({
        user_id: "anon",
        name: "Anon",
        message_content: "content",
        keyboard: [],
        is_public: false,
      });
      expect(saved).toBeNull();
    });

    await act(async () => {
      await result.current.updateScreen({ screenId: "x", update: { message_content: "m", keyboard: [] } });
      await result.current.deleteScreen("x");
      await result.current.deleteAllScreens();
    });

    act(() => {
      result.current.handleTogglePin("x");
    });

    expect(mockDataAccess.saveScreen).not.toHaveBeenCalled();
    expect(mockDataAccess.deleteScreens).not.toHaveBeenCalled();
  });
});
