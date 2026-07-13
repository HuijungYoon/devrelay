export function logInfo(message: string, meta?: Record<string, unknown>): void {
  const line = meta
    ? `${message} ${JSON.stringify(meta)}`
    : message;
  console.error(line);
}

export function logAudit(entry: {
  tool: string;
  host: string;
  userId?: number;
  ok: boolean;
  httpStatus?: number;
  durationMs: number;
  errorCode?: string;
  dryRun?: boolean;
}): void {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    })
  );
}
