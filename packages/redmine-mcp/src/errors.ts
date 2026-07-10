import { RedmineError } from "@m2i/redmine-client";

export type McpErrorPayload = {
  code: string;
  message: string;
  dataChanged: false;
  retrySafe: boolean;
  check: string[];
  httpStatus?: number;
};

export function toMcpError(err: unknown): McpErrorPayload {
  if (err instanceof RedmineError) {
    return {
      code: err.code,
      message: err.message,
      dataChanged: false,
      retrySafe: err.retrySafe,
      check: err.check,
      httpStatus: err.httpStatus,
    };
  }
  return {
    code: "REDMINE_UNKNOWN_ERROR",
    message: err instanceof Error ? err.message : String(err),
    dataChanged: false,
    retrySafe: false,
    check: ["Retry the request", "Check MCP server logs on stderr"],
  };
}
