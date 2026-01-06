import type { App } from "vue";
import { track } from "@vercel/analytics";
import * as Sentry from "@sentry/vue";

type TrackStatus = "success" | "failure";
type TrackValue = string | number | boolean;
type TrackPayload = Record<string, TrackValue>;
type TrackInput = Record<string, unknown>;

type ErrorContext = {
  flow?: string;
  action?: string;
  code?: string | null;
  metadata?: Record<string, unknown>;
  level?: "error" | "warning" | "info";
};

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

const normalizeTrackingData = (data?: TrackInput): TrackPayload => {
  const payload: TrackPayload = {};
  if (!data) {
    return payload;
  }
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      payload[key] = value;
    }
  }
  return payload;
};

const safeTrack = (event: string, data: TrackPayload) => {
  try {
    track(event, data);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Tracking failed", error);
    }
  }
};

export const initMonitoring = (app: App) => {
  if (!sentryEnabled) {
    return;
  }
  Sentry.init({
    app,
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
  });
};

export const reportError = (error: unknown, context: ErrorContext = {}) => {
  if (sentryEnabled) {
    Sentry.withScope((scope) => {
      if (context.flow) {
        scope.setTag("flow", context.flow);
      }
      if (context.action) {
        scope.setTag("action", context.action);
      }
      if (context.code) {
        scope.setTag("code", context.code);
      }
      if (context.level) {
        scope.setLevel(context.level);
      }
      if (context.metadata) {
        scope.setContext("metadata", context.metadata);
      }
      Sentry.captureException(error);
    });
  }
  if (import.meta.env.DEV || !sentryEnabled) {
    console.error(error);
  }
};

export const trackFlow = (
  flow: string,
  status: TrackStatus,
  data?: TrackInput,
) => {
  const payload = normalizeTrackingData(data);
  safeTrack("flow", { flow, status, ...payload });
  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      category: "flow",
      message: `${flow}:${status}`,
      data: payload,
      level: status === "failure" ? "warning" : "info",
    });
  }
};
