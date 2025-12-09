import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, vi, expect } from "vitest";
import Share, { buildShareScreen } from "../Share";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@/lib/dataAccess", () => {
  class FakeDataAccess {
    async getPublicScreenByToken(token: string | undefined) {
      if (token === "missing") return null;
      if (token === "boom") throw new Error("fail");
      return null;
    }
  }
  return { SupabaseDataAccess: FakeDataAccess };
});

const baseRow = {
  id: "screen-1",
  name: "Welcome",
  keyboard: [],
  message_content: "",
  share_token: "token-1",
  is_public: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  user_id: "user-1",
};

describe("Share page helpers", () => {
  it("preserves raw content when mapping Supabase rows", () => {
    const payload = JSON.stringify({
      type: "photo",
      caption: "hello world",
      photo: "https://example.com/image.jpg",
      parse_mode: "MarkdownV2",
    });
    const screen = buildShareScreen({ ...baseRow, message_content: payload });

    expect(screen.rawMessageContent).toBe(payload);
    expect(screen.message_content).toBe("hello world");
    expect(screen.message_type).toBe("photo");
    expect(screen.media_url).toBe("https://example.com/image.jpg");
  });
});

describe("Share page error states", () => {
  const renderWithToken = (token: string) =>
    render(
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<Share />} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows friendly message when token is missing/invalid", async () => {
    renderWithToken("missing");

    await waitFor(() => {
      expect(screen.getByText(/无法打开分享链接/)).toBeTruthy();
    });
    expect(screen.getByText(/未找到分享链接或链接已失效/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /返回首页/ })).toBeTruthy();
  });

  it("shows retry message when fetch throws", async () => {
    renderWithToken("boom");

    await waitFor(() => {
      expect(screen.getByText(/加载分享链接失败/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /返回首页/ })).toBeTruthy();
  });
});
