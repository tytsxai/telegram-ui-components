import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, setErrorReporter } from "../errorReporting";
import type { ErrorReportContext, ErrorReporter } from "../errorReporting";

afterEach(() => {
  setErrorReporter(null);
  vi.restoreAllMocks();
});

describe("errorReporting", () => {
  it("setErrorReporter: sets and overwrites reporter; warns when overwriting different reporter", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const reporterA: ErrorReporter = () => {};
    const reporterB: ErrorReporter = () => {};

    setErrorReporter(reporterA);
    setErrorReporter(reporterB);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[ErrorReporter] Overwriting existing reporter");
  });

  it("setErrorReporter: does not warn when setting same reporter again", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const reporter: ErrorReporter = () => {};

    setErrorReporter(reporter);
    setErrorReporter(reporter);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("reportError: calls reporter when set (passes error + context)", () => {
    const fn = vi.fn();
    setErrorReporter(fn);

    const error = new Error("boom");
    const context: ErrorReportContext = { source: "supabase", action: "insert", requestId: "r1" };

    reportError(error, context);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(error, context);
  });

  it("reportError: is silent when no reporter set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setErrorReporter(null);
    reportError(new Error("no reporter"), { source: "window_error" });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reportError: catches reporter exceptions and logs console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("reporter failed");

    const badReporter: ErrorReporter = () => {
      throw thrown;
    };
    setErrorReporter(badReporter);

    expect(() => reportError(new Error("original"), { source: "unhandled_rejection" })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("[ErrorReporter] publish failed", thrown);
  });
});
