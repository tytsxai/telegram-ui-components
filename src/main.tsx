import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setSyncTelemetryPublisher, getSyncTelemetryPublisher } from "@/lib/syncTelemetry";
import RuntimeConfigError from "@/components/RuntimeConfigError";
import { getRuntimeConfigReport, logRuntimeConfigIssues } from "@/lib/runtimeConfig";
import { initErrorReporting } from "@/lib/errorReportingClient";

const normalizeGlobalBuffer = () => {
  const buffer = globalThis.Buffer as unknown;
  if (typeof buffer === "undefined") return;
  if (typeof buffer === "function") return;
  try {
    delete (globalThis as { Buffer?: unknown }).Buffer;
  } catch {
    (globalThis as { Buffer?: unknown }).Buffer = undefined;
  }
};

const instrumentDefineProperty = () => {
  if (!import.meta.env.DEV) return;
  const original = Object.defineProperty;
  Object.defineProperty = ((target, propertyKey, descriptor) => {
    const isValidTarget = target !== null && (typeof target === "object" || typeof target === "function");
    if (!isValidTarget) {
      console.error("[defineProperty] invalid target", {
        target,
        targetType: typeof target,
        propertyKey,
        descriptor,
        stack: new Error().stack,
      });
    }
    return original(target as object, propertyKey as PropertyKey, descriptor as PropertyDescriptor);
  }) as typeof Object.defineProperty;
};

if (!getSyncTelemetryPublisher()) {
  setSyncTelemetryPublisher((event) => {
    if (import.meta.env.DEV) {
      console.info("[Telemetry]", {
        scope: event.scope,
        state: event.status.state,
        requestId: event.status.requestId,
        message: event.status.message,
        at: event.status.at || Date.now(),
        userId: event.meta?.userId,
        action: event.meta?.action,
        targetId: event.meta?.targetId,
      });
    }
  });
}

normalizeGlobalBuffer();
instrumentDefineProperty();
initErrorReporting();

const runtimeReport = getRuntimeConfigReport();
logRuntimeConfigIssues(runtimeReport);

const root = createRoot(document.getElementById("root")!);
if (runtimeReport.hasBlockingIssues) {
  root.render(<RuntimeConfigError report={runtimeReport} />);
} else {
  root.render(<App />);
}
