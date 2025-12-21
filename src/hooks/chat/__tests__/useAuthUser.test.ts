import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

type AuthChangeCallback = (event: string, session: { user: User } | null) => void;

const getUserMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();
let capturedAuthCallback: AuthChangeCallback | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
  },
}));

import { useAuthUser } from "../useAuthUser";

describe("useAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedAuthCallback = null;

    onAuthStateChangeMock.mockImplementation((cb: AuthChangeCallback) => {
      capturedAuthCallback = cb;
      return {
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      };
    });
  });

  it("initial state: user is null", () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { result } = renderHook(() => useAuthUser());

    expect(result.current.user).toBeNull();
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1);
  });

  it("getUser success: sets user", async () => {
    const mockUser = { id: "u1" } as unknown as User;
    getUserMock.mockResolvedValue({ data: { user: mockUser } });

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current.user).toBe(mockUser);
    });

    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("getUser failure: keeps user null and does not throw", async () => {
    getUserMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("onAuthStateChange: updates user when session changes", async () => {
    const initialUser = { id: "init" } as unknown as User;
    getUserMock.mockResolvedValue({ data: { user: initialUser } });

    const { result } = renderHook(() => useAuthUser());

    await waitFor(() => {
      expect(result.current.user).toBe(initialUser);
    });

    const nextUser = { id: "next" } as unknown as User;

    act(() => {
      expect(capturedAuthCallback).toBeTypeOf("function");
      capturedAuthCallback?.("SIGNED_IN", { user: nextUser });
    });

    expect(result.current.user).toBe(nextUser);

    act(() => {
      capturedAuthCallback?.("SIGNED_OUT", null);
    });

    expect(result.current.user).toBeNull();
  });

  it("cleanup: calls unsubscribe", () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { unmount } = renderHook(() => useAuthUser());

    expect(unsubscribeMock).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
