import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAuditEvent, getAuditEvents } from "../auditTrail";

describe("auditTrail", () => {
  const STORAGE_KEY = "audit_events_v1";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("recordAuditEvent: records event with generated id and timestamp", () => {
    const event = recordAuditEvent({
      action: "share_publish",
      status: "success",
      userId: "u1",
      targetId: "screen-1",
    });

    expect(event.id).toBeTruthy();
    expect(event.at).toBeGreaterThan(0);
    expect(event.action).toBe("share_publish");
    expect(event.status).toBe("success");
    expect(event.userId).toBe("u1");
    expect(event.targetId).toBe("screen-1");
  });

  it("recordAuditEvent: uses provided timestamp when given", () => {
    const customTime = 1234567890;
    const event = recordAuditEvent({
      action: "share_revoke",
      status: "error",
      at: customTime,
    });

    expect(event.at).toBe(customTime);
  });

  it("getAuditEvents: returns recorded events", () => {
    recordAuditEvent({ action: "share_publish", status: "success" });
    recordAuditEvent({ action: "share_rotate", status: "success" });

    const events = getAuditEvents();
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("share_publish");
    expect(events[1].action).toBe("share_rotate");
  });

  it("getAuditEvents: returns empty array when no events", () => {
    expect(getAuditEvents()).toEqual([]);
  });

  it("persists events to localStorage", () => {
    recordAuditEvent({ action: "import_json", status: "success" });

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe("import_json");
  });

  it("handles malformed JSON in localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json");

    const events = getAuditEvents();
    expect(events).toEqual([]);
  });

  it("handles non-array JSON in localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "array" }));

    const events = getAuditEvents();
    expect(events).toEqual([]);
  });

  it("limits stored events to MAX_EVENTS (200)", () => {
    for (let i = 0; i < 210; i++) {
      recordAuditEvent({ action: "share_publish", status: "success", message: `event-${i}` });
    }

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.length).toBeLessThanOrEqual(200);
  });

  it("handles localStorage write failure gracefully", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() =>
      recordAuditEvent({ action: "share_publish", status: "success" })
    ).not.toThrow();

    setItemSpy.mockRestore();
  });
});
