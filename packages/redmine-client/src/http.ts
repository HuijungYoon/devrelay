import { readFileSync } from "node:fs";
import { Agent, type Dispatcher } from "undici";
import type { RedmineConfig } from "./config.js";
import { RedmineError } from "./errors.js";
import { maskSecret } from "./mask.js";

const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;

export type RedmineHttpOptions = {
  retryBackoffMs?: number;
};

export class RedmineHttp {
  private readonly dispatcher?: Dispatcher;

  constructor(
    private readonly config: RedmineConfig,
    private readonly opts: RedmineHttpOptions = {}
  ) {
    if (config.caCertPath) {
      const ca = readFileSync(config.caCertPath);
      this.dispatcher = new Agent({ connect: { ca } });
    }
  }

  async getJson<T>(
    path: string,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await this.request(url);
        if (RETRYABLE.has(response.status) && attempt < MAX_RETRIES) {
          await this.sleep(this.backoffMs(attempt));
          attempt += 1;
          continue;
        }
        if (!response.ok) {
          const bodyText = await response.text();
          this.mapStatus(response.status, bodyText);
        }
        return (await response.json()) as T;
      } catch (err) {
        if (err instanceof RedmineError) {
          throw this.maskError(err);
        }
        lastError = err;
        if (this.isRetryableNetworkError(err) && attempt < MAX_RETRIES) {
          await this.sleep(this.backoffMs(attempt));
          attempt += 1;
          continue;
        }
        throw this.mapNetworkError(err);
      }
    }

    throw this.mapNetworkError(lastError);
  }

  async postJson<T>(path: string, body: unknown): Promise<T | undefined> {
    return this.sendJson<T>("POST", path, body);
  }

  async putJson<T>(path: string, body: unknown): Promise<T | undefined> {
    return this.sendJson<T>("PUT", path, body);
  }

  private async sendJson<T>(
    method: "POST" | "PUT",
    path: string,
    body: unknown
  ): Promise<T | undefined> {
    const url = this.buildUrl(path);
    try {
      const response = await this.request(
        url,
        method,
        JSON.stringify(body)
      );
      if (!response.ok) {
        const bodyText = await response.text();
        this.mapStatus(response.status, bodyText, path);
      }
      if (response.status === 204) {
        return undefined;
      }
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof RedmineError) {
        throw this.maskError(err);
      }
      throw this.mapNetworkError(err);
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | undefined>
  ): string {
    // Leading "/" drops baseUrl path segments (e.g. /redmine).
    const relativePath = path.replace(/^\//, "");
    const url = new URL(relativePath, `${this.config.baseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request(
    url: string,
    method = "GET",
    body?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.config.userAgent,
      "X-Redmine-API-Key": this.config.apiKey,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit & { dispatcher?: Dispatcher } = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    };
    if (body !== undefined) {
      init.body = body;
    }
    if (this.dispatcher) {
      init.dispatcher = this.dispatcher;
    }

    return fetch(url, init);
  }

  private mapStatus(
    status: number,
    bodyText: string,
    path?: string
  ): never {
    const maskedBody = maskSecret(bodyText, this.config.apiKey);
    if (status === 401) {
      throw new RedmineError({
        code: "REDMINE_AUTHENTICATION_ERROR",
        message: "Redmine authentication failed",
        httpStatus: status,
        check: ["Verify REDMINE_API_KEY"],
        retrySafe: false,
      });
    }
    if (status === 403) {
      throw new RedmineError({
        code: "REDMINE_PERMISSION_DENIED",
        message: "Redmine permission denied",
        httpStatus: status,
        check: ["Confirm the user can access this resource in Redmine"],
        retrySafe: false,
      });
    }
    if (status === 404) {
      const issuePath = path?.includes("/issues/");
      throw new RedmineError({
        code: issuePath
          ? "REDMINE_ISSUE_NOT_FOUND"
          : "REDMINE_UNKNOWN_ERROR",
        message: `Redmine resource not found: ${maskedBody || status}`,
        httpStatus: status,
        retrySafe: false,
      });
    }
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: `Redmine HTTP ${status}: ${maskedBody || "request failed"}`,
      httpStatus: status,
      retrySafe: RETRYABLE.has(status),
      check: ["Retry later if Redmine is temporarily unavailable"],
    });
  }

  private mapNetworkError(err: unknown): RedmineError {
    const message = maskSecret(
      err instanceof Error ? err.message : String(err),
      this.config.apiKey
    );
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return new RedmineError({
        code: "REDMINE_TIMEOUT",
        message: `Redmine request timed out: ${message}`,
        retrySafe: true,
        check: ["Increase REDMINE_REQUEST_TIMEOUT_MS", "Check Redmine health"],
      });
    }
    if (/certificate|SSL|TLS|CERT/i.test(message)) {
      return new RedmineError({
        code: "REDMINE_TLS_ERROR",
        message: `Redmine TLS error: ${message}`,
        retrySafe: false,
        check: ["Set REDMINE_CA_CERT_PATH to your company CA file"],
      });
    }
    return new RedmineError({
      code: "REDMINE_CONNECTION_ERROR",
      message: `Cannot reach Redmine: ${message}`,
      retrySafe: true,
      check: ["Verify REDMINE_URL", "Check VPN / network connectivity"],
    });
  }

  private isRetryableNetworkError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    if (err.name === "TimeoutError" || err.name === "AbortError") return false;
    return true;
  }

  private maskError(err: RedmineError): RedmineError {
    return new RedmineError({
      code: err.code,
      message: maskSecret(err.message, this.config.apiKey),
      httpStatus: err.httpStatus,
      retrySafe: err.retrySafe,
      check: err.check,
    });
  }

  private backoffMs(attempt: number): number {
    const base = this.opts.retryBackoffMs ?? 200;
    return base * 2 ** attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
