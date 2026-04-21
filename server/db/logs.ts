export type SystemLog = {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "critical";
  message: string;
  source: string;
};

const logs: SystemLog[] = [];

export function addSystemLog(level: SystemLog["level"], source: string, message: string) {
  const log: SystemLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };
  
  // Keep last 100 logs
  logs.unshift(log);
  if (logs.length > 100) {
    logs.pop();
  }
  
  return log;
}

export function getSystemLogs(): SystemLog[] {
  return [...logs];
}
