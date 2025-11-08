const DEBUG = import.meta.env.MODE === "development";

export const log = {
  info: (...args: any[]) => DEBUG && console.info("[ZuraBase]", ...args),
  warn: (...args: any[]) => DEBUG && console.warn("[ZuraBase Warn]", ...args),
  error: (...args: any[]) => console.error("[ZuraBase Error]", ...args),
  debug: (...args: any[]) =>
    DEBUG && console.debug("[ZuraBase Debug]", ...args),

  // API-specific logging methods
  apiRequest: (module: string, method: string, url: string, data?: any) => {
    if (DEBUG) {
      console.info(`[${module}] ${method} ${url}`, data || "");
    }
  },
  apiResponse: (
    module: string,
    method: string,
    url: string,
    status: number,
    data?: any
  ) => {
    if (DEBUG) {
      console.info(`[${module}] ${method} ${url} → ${status}`, data || "");
    }
  },
  apiError: (module: string, method: string, url: string, error: Error) => {
    console.error(`[${module}] ${method} ${url} → ERROR:`, error.message);
  },
};

// Suppress React DevTools warning
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === "string" && args[0].includes("React DevTools")) {
    return;
  }
  originalWarn(...args);
};
