export type SystemLog = {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "critical";
  message: string;
  source: string;
};

/** In-memory log buffer — always available as fallback */
const logs: SystemLog[] = [];

/**
 * Optional Firestore persister injected by firebase.ts after DB init.
 * Using dependency injection avoids a circular import:
 *   firebase.ts → logs.ts (for addSystemLog)
 *   logs.ts ← firebase.ts (would be circular)
 */
type PersistFn = (log: SystemLog) => void;
let persistFn: PersistFn | null = null;

/** Called once by firebase.ts right after Firestore is ready. */
export function setLogPersister(fn: PersistFn): void {
  persistFn = fn;
}

export function addSystemLog(level: SystemLog["level"], source: string, message: string): SystemLog {
  const log: SystemLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };

  // Keep the last 500 logs in memory
  logs.unshift(log);
  if (logs.length > 500) {
    logs.pop();
  }

  // Fire-and-forget Firestore write if persister is available
  if (persistFn) {
    try {
      persistFn(log);
    } catch {
      // Never let a log write crash the server
    }
  }

  return log;
}

export function getSystemLogs(): SystemLog[] {
  return [...logs];
}
