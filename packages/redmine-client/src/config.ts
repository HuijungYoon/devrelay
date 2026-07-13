import { RedmineError } from "./errors.js";

export type RedmineConfig = {
  baseUrl: string;
  apiKey: string;
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  maxResultCount: number;
  logLevel: string;
  caCertPath?: string;
  allowedHosts?: string[];
  defaultProjectId?: number;
  userAgent: string;
};

const FORBIDDEN_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"]);

/** Loopback / compose service names allowed for local Docker http. */
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "redmine"]);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function parseIntEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Invalid ${name}: ${raw}`,
      check: [`Set ${name} to a positive number`],
    });
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RedmineConfig {
  const urlRaw = env.REDMINE_URL?.trim();
  const apiKey = env.REDMINE_API_KEY?.trim();
  if (!urlRaw || !apiKey) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "REDMINE_URL and REDMINE_API_KEY are required",
      check: ["Export REDMINE_URL", "Export REDMINE_API_KEY"],
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(urlRaw);
  } catch {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Invalid REDMINE_URL: ${urlRaw}`,
      check: ["Use an absolute URL like https://redmine.example.com"],
    });
  }

  if (parsed.protocol === "file:" || parsed.protocol === "ftp:") {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Forbidden URL protocol: ${parsed.protocol}`,
    });
  }

  const host = parsed.hostname.toLowerCase();
  if (FORBIDDEN_HOSTS.has(host) || host.startsWith("169.254.")) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "Forbidden link-local/metadata host",
    });
  }

  const allowedHosts = env.REDMINE_ALLOWED_HOSTS
    ?.split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedHosts?.length &&
    !allowedHosts.includes(host) &&
    !isPrivateIpv4(host)
  ) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Host ${host} is not in REDMINE_ALLOWED_HOSTS`,
      check: ["Add the Redmine hostname to REDMINE_ALLOWED_HOSTS"],
    });
  }

  const isInsecureHttpAllowed =
    parsed.protocol === "http:" &&
    (isPrivateIpv4(host) ||
      (LOCAL_HTTP_HOSTS.has(host) && !!allowedHosts?.includes(host)));

  if (parsed.protocol !== "https:" && !isInsecureHttpAllowed) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message:
        "REDMINE_URL must use https (http only for private IPs or allowlisted local hosts)",
      check: [
        "Use https://...",
        "Or use an RFC1918 private IP over http",
        "Or allowlist localhost/redmine for Docker tests",
      ],
    });
  }

  const baseUrl = urlRaw.replace(/\/$/, "");

  return {
    baseUrl,
    apiKey,
    connectTimeoutMs: parseIntEnv(env, "REDMINE_CONNECT_TIMEOUT_MS", 5000),
    requestTimeoutMs: parseIntEnv(env, "REDMINE_REQUEST_TIMEOUT_MS", 15000),
    maxResultCount: parseIntEnv(env, "REDMINE_MAX_RESULT_COUNT", 100),
    logLevel: env.REDMINE_LOG_LEVEL ?? "info",
    caCertPath: env.REDMINE_CA_CERT_PATH || undefined,
    allowedHosts,
    defaultProjectId: env.REDMINE_DEFAULT_PROJECT_ID
      ? Number(env.REDMINE_DEFAULT_PROJECT_ID)
      : undefined,
    userAgent: "redmine-mcp/0.1.0",
  };
}
