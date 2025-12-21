import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setSyncTelemetryPublisher,
  getSyncTelemetryPublisher,
  publishSyncEvent,
} from "../syncTelemetry";
import type { SyncTelemetryEvent } from "../syncTelemetry";

afterEach(() => {
  setSyncTelemetryPublisher(null);
  vi.restoreAllMocks();
});

describe("syncTelemetry", () => {
  it("setSyncTelemetryPublisher: sets publisher", () => {
    const pub = vi.fn();
    setSyncTelemetryPublisher(pub);
    expect(getSyncTelemetryPublisher()).toBe(pub);
  });

  it("setSyncTelemetryPublisher: warns when overwriting different publisher", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const pubA = vi.fn();
    const pubB = vi.fn();

    setSyncTelemetryPublisher(pubA);
    setSyncTelemetryPublisher(pubB);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[SyncTelemetry] Overwriting existing publisher");
  });

  it("setSyncTelemetryPublisher: does not warn when setting same publisher", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const pub = vi.fn();
    setSyncTelemetryPublisher(pub);
    setSyncTelemetryPublisher(pub);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("getSyncTelemetryPublisher: returns current publisher", () => {
    expect(getSyncTelemetryPublisher()).toBeNull();

    const pub = vi.fn();
    setSyncTelemetryPublisher(pub);
    expect(getSyncTelemetryPublisher()).toBe(pub);
  });

  it("publishSyncEvent: calls publisher when set", () => {
    const pub = vi.fn();
    setSyncTelemetryPublisher(pub);

    const event: SyncTelemetryEvent = {
      scope: "share",
      status: "synced",
      meta: { userId: "u1", action: "publish" },
    };

    publishSyncEvent(event);

    expect(pub).toHaveBeenCalledTimes(1);
    expect(pub).toHaveBeenCalledWith(event);
  });

  it("publishSyncEvent: is silent when no publisher set", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setSyncTelemetryPublisher(null);
    publishSyncEvent({ scope: "layout", status: "pending" });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("publishSyncEvent: catches publisher exceptions and logs console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("pub failed");

    const badPub = () => {
      throw thrown;
    };
    setSyncTelemetryPublisher(badPub);

    expect(() => publishSyncEvent({ scope: "queue", status: "error" })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[SyncTelemetry] publish failed", thrown);
  });
});
