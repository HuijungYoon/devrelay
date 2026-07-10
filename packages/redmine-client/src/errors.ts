export type RedmineErrorCode =
  | "REDMINE_CONNECTION_ERROR"
  | "REDMINE_AUTHENTICATION_ERROR"
  | "REDMINE_PERMISSION_DENIED"
  | "REDMINE_ISSUE_NOT_FOUND"
  | "REDMINE_PROJECT_NOT_FOUND"
  | "REDMINE_VALIDATION_ERROR"
  | "REDMINE_TIMEOUT"
  | "REDMINE_TLS_ERROR"
  | "REDMINE_UNKNOWN_ERROR";

export class RedmineError extends Error {
  readonly code: RedmineErrorCode;
  readonly httpStatus?: number;
  readonly dataChanged = false as const;
  readonly retrySafe: boolean;
  readonly check: string[];

  constructor(opts: {
    code: RedmineErrorCode;
    message: string;
    httpStatus?: number;
    retrySafe?: boolean;
    check?: string[];
  }) {
    super(opts.message);
    this.name = "RedmineError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.retrySafe = opts.retrySafe ?? false;
    this.check = opts.check ?? [];
  }
}
