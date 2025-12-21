import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce, throttle } from "../debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("delays execution until wait passes", () => {
    const fn = vi.fn();
    const d = debounce(fn, 50);

    d("a");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(49);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("only executes the last call when invoked multiple times within wait", () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);

    d("first");
    vi.advanceTimersByTime(50);
    d("second");
    vi.advanceTimersByTime(50);
    d("third");

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("third");
  });

  it("clears the previous timeout on repeated calls", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const fn = vi.fn();
    const d = debounce(fn, 10);

    d("a");
    d("b");

    expect(clearSpy).toHaveBeenCalledTimes(1);
    clearSpy.mockRestore();
  });

  it("handles wait=0", () => {
    const fn = vi.fn();
    const d = debounce(fn, 0);

    d("x");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledWith("x");
  });
});

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("executes immediately on first call", () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);

    t("first");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("blocks subsequent calls within limit", () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);

    t("first");
    t("second");
    t("third");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("allows calls after limit passes", () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);

    t("first");
    vi.advanceTimersByTime(100);
    t("second");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("second");
  });

  it("handles limit=0", () => {
    const fn = vi.fn();
    const t = throttle(fn, 0);

    t("a");
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(0);
    t("b");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
