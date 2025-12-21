import { describe, it, expect } from "vitest";
import { buildAppUrl, normalizeBasePath } from "../appUrl";

describe("appUrl helpers", () => {
  it("normalizes base paths with leading/trailing slashes", () => {
    expect(normalizeBasePath(undefined)).toBe("/");
    expect(normalizeBasePath("app")).toBe("/app/");
    expect(normalizeBasePath("/app")).toBe("/app/");
    expect(normalizeBasePath("/app/")).toBe("/app/");
  });

  it("builds URLs with base path and origin", () => {
    const url = buildAppUrl("share/abc", {
      origin: "https://example.com",
      base: "/builder/",
    });
    expect(url).toBe("https://example.com/builder/share/abc");
  });

  it("builds URLs without origin for non-browser contexts", () => {
    const url = buildAppUrl("/auth", { base: "/", origin: "" });
    expect(url).toBe("/auth");
  });
});
