# Redmine MCP Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only `redmine-mcp` STDIO server (4 tools), thin Claude/Codex plugins with `/redmine:my-issues` and `/redmine:issue` skills, Docker-backed tests, and internal npm `0.1.0` publish readiness.

**Architecture:** Monorepo with `redmine-client` (REST/auth/pagination/errors) and `redmine-mcp` (schemas + STDIO tools). Plugins only wire env + MCP + two thin skills. Schema-first, TDD, no write tools.

**Tech Stack:** Node.js 20+, pnpm workspaces, TypeScript, Vitest, `@modelcontextprotocol/sdk` 1.x (pin exact version at install), Zod or JSON Schema for tool inputs, Docker Compose for Redmine, undici/fetch for HTTP.

**Spec:** `docs/superpowers/specs/2026-07-10-redmine-mcp-phase1-design.md`

---

## File Structure (create)

```
packages/redmine-client/
  package.json
  tsconfig.json
  src/index.ts
  src/config.ts
  src/errors.ts
  src/mask.ts
  src/http.ts
  src/types.ts
  src/projects.ts
  src/issues.ts
  tests/config.test.ts
  tests/mask.test.ts
  tests/http.test.ts
  tests/projects.test.ts
  tests/issues.test.ts

packages/redmine-mcp/
  package.json
  tsconfig.json
  src/index.ts              # bin entry
  src/server.ts
  src/logging.ts
  src/errors.ts             # map RedmineError → MCP error payload
  src/tools/schemas.ts
  src/tools/connection.ts
  src/tools/projects.ts
  src/tools/issues.ts
  tests/schemas.test.ts
  tests/tools.connection.test.ts
  tests/tools.issues.test.ts

plugins/claude-code/
  .claude-plugin/plugin.json
  .mcp.json
  skills/my-issues/SKILL.md
  skills/issue/SKILL.md
  README.md

plugins/codex/
  .codex-plugin/plugin.json
  .mcp.json
  skills/my-issues/SKILL.md
  skills/issue/SKILL.md
  README.md

docker/redmine/
  docker-compose.yml
  README.md

docs/installation.md
docs/security.md
docs/troubleshooting.md
docs/development.md
package.json
pnpm-workspace.yaml
tsconfig.base.json
.gitignore
README.md
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `README.md`
- Create: `packages/redmine-client/package.json`, `packages/redmine-client/tsconfig.json`
- Create: `packages/redmine-mcp/package.json`, `packages/redmine-mcp/tsconfig.json`

- [ ] **Step 1: Create root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

Root `package.json`:
```json
{
  "name": "redmine-agent-integration",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  },
  "engines": {
    "node": ">=20"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
*.log
.DS_Store
```

- [ ] **Step 2: Create package manifests**

`packages/redmine-client/package.json`:
```json
{
  "name": "redmine-client",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "5.8.2",
    "vitest": "3.0.9",
    "@types/node": "22.13.10"
  }
}
```

`packages/redmine-client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

`packages/redmine-mcp/package.json`:
```json
{
  "name": "redmine-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "redmine-mcp": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "redmine-client": "workspace:*",
    "@modelcontextprotocol/sdk": "1.12.1"
  },
  "devDependencies": {
    "typescript": "5.8.2",
    "vitest": "3.0.9",
    "@types/node": "22.13.10"
  }
}
```

> If `1.12.1` is unavailable at install time, pin the latest **stable 1.x** that installs cleanly and update this plan’s version string + lockfile together. Do not use SDK v2.

`packages/redmine-mcp/tsconfig.json`: same pattern as client (`outDir: dist`, `rootDir: src`).

- [ ] **Step 3: Install and verify**

Run:
```bash
pnpm install
```
Expected: lockfile created, both packages linked, no peer errors for SDK 1.x.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore README.md packages pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo for redmine-client and redmine-mcp"
```

---

### Task 2: Errors, masking, and config (client)

**Files:**
- Create: `packages/redmine-client/src/errors.ts`, `mask.ts`, `config.ts`, `index.ts`
- Test: `packages/redmine-client/tests/mask.test.ts`, `tests/config.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/redmine-client/tests/mask.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { maskSecret } from "../src/mask.js";

describe("maskSecret", () => {
  it("replaces api key substrings", () => {
    const key = "abcd1234efgh5678";
    expect(maskSecret(`key=${key}`, key)).toBe("key=***");
  });

  it("returns original when secret empty", () => {
    expect(maskSecret("hello", "")).toBe("hello");
  });
});
```

`packages/redmine-client/tests/config.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("loadConfig", () => {
  it("requires REDMINE_URL and REDMINE_API_KEY", () => {
    delete process.env.REDMINE_URL;
    delete process.env.REDMINE_API_KEY;
    expect(() => loadConfig()).toThrow(/REDMINE_URL|REDMINE_API_KEY/);
  });

  it("rejects non-https in production mode", () => {
    process.env.REDMINE_URL = "http://evil.example.com";
    process.env.REDMINE_API_KEY = "k";
    expect(() => loadConfig()).toThrow(/https/i);
  });

  it("allows http localhost when host is allowlisted", () => {
    process.env.REDMINE_URL = "http://localhost:3000";
    process.env.REDMINE_API_KEY = "k";
    process.env.REDMINE_ALLOWED_HOSTS = "localhost";
    const cfg = loadConfig();
    expect(cfg.baseUrl).toBe("http://localhost:3000");
  });

  it("rejects metadata IP", () => {
    process.env.REDMINE_URL = "http://169.254.169.254/";
    process.env.REDMINE_API_KEY = "k";
    process.env.REDMINE_ALLOWED_HOSTS = "169.254.169.254";
    expect(() => loadConfig()).toThrow(/metadata|link-local|forbidden/i);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter redmine-client test`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement**

`packages/redmine-client/src/errors.ts`:
```ts
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
```

`packages/redmine-client/src/mask.ts`:
```ts
export function maskSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("***");
}
```

`packages/redmine-client/src/config.ts`:
```ts
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

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
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

  if (allowedHosts?.length && !allowedHosts.includes(host)) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Host ${host} is not in REDMINE_ALLOWED_HOSTS`,
      check: ["Add the Redmine hostname to REDMINE_ALLOWED_HOSTS"],
    });
  }

  const isLocalHttp =
    parsed.protocol === "http:" &&
    (host === "localhost" || host === "127.0.0.1" || host === "redmine") &&
    !!allowedHosts?.includes(host);

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "REDMINE_URL must use https (http only for allowlisted local Docker hosts)",
      check: ["Use https://...", "Or allowlist localhost/redmine for Docker tests"],
    });
  }

  const baseUrl = urlRaw.replace(/\/$/, "");

  return {
    baseUrl,
    apiKey,
    connectTimeoutMs: parseIntEnv("REDMINE_CONNECT_TIMEOUT_MS", 5000),
    requestTimeoutMs: parseIntEnv("REDMINE_REQUEST_TIMEOUT_MS", 15000),
    maxResultCount: parseIntEnv("REDMINE_MAX_RESULT_COUNT", 100),
    logLevel: env.REDMINE_LOG_LEVEL ?? "info",
    caCertPath: env.REDMINE_CA_CERT_PATH || undefined,
    allowedHosts,
    defaultProjectId: env.REDMINE_DEFAULT_PROJECT_ID
      ? Number(env.REDMINE_DEFAULT_PROJECT_ID)
      : undefined,
    userAgent: "redmine-mcp/0.1.0",
  };
}
```

`packages/redmine-client/src/index.ts` — re-export `loadConfig`, `RedmineError`, `maskSecret` for now.

Add `vitest.config.ts` in client package:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter redmine-client test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-client
git commit -m "feat(client): add config validation, errors, and secret masking"
```

---

### Task 3: HTTP layer with GET retry

**Files:**
- Create: `packages/redmine-client/src/http.ts`
- Test: `packages/redmine-client/tests/http.test.ts`

- [ ] **Step 1: Write failing test with mock fetch**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const baseConfig: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "secret-key",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.1.0",
};

describe("RedmineHttp", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends X-Redmine-API-Key and Accept headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig);
    await http.getJson("/users/current.json");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Redmine-API-Key"]).toBe("secret-key");
    expect(init.headers["Accept"]).toBe("application/json");
  });

  it("maps 401 to AUTHENTICATION_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    );
    const http = new RedmineHttp(baseConfig);
    await expect(http.getJson("/users/current.json")).rejects.toMatchObject({
      code: "REDMINE_AUTHENTICATION_ERROR",
    });
  });

  it("retries GET on 503 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(baseConfig, { retryBackoffMs: 1 });
    const data = await http.getJson<{ user: { id: number } }>("/users/current.json");
    expect(data.user.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter redmine-client exec vitest run tests/http.test.ts`
Expected: FAIL (RedmineHttp missing)

- [ ] **Step 3: Implement `RedmineHttp`**

Implement in `src/http.ts`:

- Build URL as `${baseUrl}${path}` (path starts with `/`)
- Headers: `Accept`, `User-Agent`, `X-Redmine-API-Key`; add `Content-Type: application/json` only when body present
- AbortSignal via `AbortSignal.timeout(requestTimeoutMs)` (Node 20+)
- On network/TLS errors → `REDMINE_CONNECTION_ERROR` or `REDMINE_TLS_ERROR`
- On abort → `REDMINE_TIMEOUT`
- Status mapping: 401 → AUTHENTICATION, 403 → PERMISSION_DENIED, 404 → UNKNOWN (callers refine to ISSUE/PROJECT), 429/502/503/504 → retry GET up to 2 times with exponential backoff
- Mask `apiKey` in any Error message before throwing
- Optional `caCertPath`: if set, create undici `Agent` with `connect.ca` from file contents (document Node undici Dispatcher usage); if too heavy for first pass, gate behind test skip and implement in same task before commit

Minimal shape:
```ts
export class RedmineHttp {
  constructor(
    private readonly config: RedmineConfig,
    private readonly opts: { retryBackoffMs?: number } = {}
  ) {}

  async getJson<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    // build URLSearchParams, omit undefined
    // retry loop for GET
  }

  private mapStatus(status: number, bodyText: string): never {
    // throw RedmineError
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/redmine-client
git commit -m "feat(client): add HTTP GET client with retries and error mapping"
```

---

### Task 4: Projects + current user API

**Files:**
- Create: `packages/redmine-client/src/types.ts`, `src/projects.ts`
- Test: `packages/redmine-client/tests/projects.test.ts`
- Modify: `packages/redmine-client/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { RedmineClient } from "../src/index.js";

describe("projects", () => {
  it("getCurrentUser normalizes name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: 15, login: "user01", firstname: "길동", lastname: "홍" },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.REDMINE_URL = "https://redmine.example.com";
    process.env.REDMINE_API_KEY = "k";
    const client = RedmineClient.fromEnv();
    const user = await client.getCurrentUser();
    expect(user).toEqual({ id: 15, login: "user01", name: "홍 길동" });
  });

  it("listProjects filters by search client-side when needed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            projects: [
              { id: 1, identifier: "cloud-hmi", name: "Cloud HMI", description: "", is_public: true, parent: null, status: 1 },
              { id: 2, identifier: "other", name: "Other", description: "", is_public: true, parent: null, status: 1 },
            ],
            total_count: 2,
            offset: 0,
            limit: 100,
          }),
          { status: 200 }
        )
      )
    );
    process.env.REDMINE_URL = "https://redmine.example.com";
    process.env.REDMINE_API_KEY = "k";
    const client = RedmineClient.fromEnv();
    const res = await client.listProjects({ search: "Cloud", limit: 50 });
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].identifier).toBe("cloud-hmi");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

- `getCurrentUser()` → `GET /users/current.json`
- `listProjects({ search?, limit? })` → `GET /projects.json` with pagination (`limit` max 100 per page), stop at `maxResultCount`, optional case-insensitive filter on `name`/`identifier`
- Normalize to `{ id, identifier, name, description, isPublic, parent, status }`
- Export `class RedmineClient { static fromEnv(); constructor(http, config); ... }`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(client): add current user and list projects"
```

---

### Task 5: Issue search + get issue

**Files:**
- Create: `packages/redmine-client/src/issues.ts`
- Test: `packages/redmine-client/tests/issues.test.ts`
- Modify: `packages/redmine-client/src/index.ts`

- [ ] **Step 1: Write failing tests**

Cover:

1. Default `status_id=open` when status omitted or `"open"`
2. `assignedTo: "me"` → `assigned_to_id=me`
3. Pagination: first page `total_count=150`, `limit=100` → second request offset 100; returned capped by `maxResultCount`
4. `getIssue(1523, { include: ["journals"] })` → path includes `include=journals`
5. HTTP 404 on getIssue → `REDMINE_ISSUE_NOT_FOUND`

Example assertion for filter building (unit-test a pure `buildIssueQuery` if easier):
```ts
expect(buildIssueQuery({ assignedTo: "me", status: "open" })).toMatchObject({
  assigned_to_id: "me",
  status_id: "open",
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `searchIssues` and `getIssue`**

`searchIssues` input type:
```ts
export type SearchIssuesInput = {
  projectId?: number;
  issueId?: number;
  assignedTo?: string | number; // "me" or id
  status?: "open" | "closed" | "all" | number;
  trackerId?: number;
  priorityId?: number;
  subjectContains?: string;
  createdAfter?: string;
  updatedAfter?: string;
  parentIssueId?: number;
  customFields?: Array<{ id: number; value: string }>;
  sort?: Array<{ field: string; direction: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
};
```

Return:
```ts
{
  issues: NormalizedIssueSummary[];
  totalCount: number;
  returnedCount: number;
  hasMore: boolean;
}
```

`getIssue`:
- Map 404 → `REDMINE_ISSUE_NOT_FOUND`
- Normalize journals/attachments metadata/relations/children/allowed_statuses when present

Do **not** N+1 fetch details inside `searchIssues`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(client): add issue search and get issue"
```

---

### Task 6: MCP tool schemas (schema-first)

**Files:**
- Create: `packages/redmine-mcp/src/tools/schemas.ts`
- Test: `packages/redmine-mcp/tests/schemas.test.ts`

- [ ] **Step 1: Write schema reject/accept tests**

Use AJV or Zod. Prefer Zod for DX; expose JSON Schema to MCP via `zod-to-json-schema` **or** hand-written JSON Schema objects with `additionalProperties: false`.

Tests:
```ts
it("rejects unknown properties on search", () => {
  expect(safeParseSearch({ limit: 10, hack: true }).success).toBe(false);
});
it("accepts empty connection args", () => {
  expect(safeParseConnection({}).success).toBe(true);
});
it("requires positive issueId", () => {
  expect(safeParseGetIssue({ issueId: -1 }).success).toBe(false);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Define four schemas**

| Tool | Required | Notes |
| --- | --- | --- |
| `redmine_test_connection` | `{}` | no props |
| `redmine_list_projects` | optional `search`, `limit` | limit 1..max |
| `redmine_search_issues` | filters as in spec | default status open applied in handler if omitted |
| `redmine_get_issue` | `issueId` | `include` enum array |

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mcp): freeze JSON schemas for four read tools"
```

---

### Task 7: MCP server + tool handlers

**Files:**
- Create: `packages/redmine-mcp/src/logging.ts`, `errors.ts`, `server.ts`, `index.ts`
- Create: `packages/redmine-mcp/src/tools/connection.ts`, `projects.ts`, `issues.ts`
- Test: `packages/redmine-mcp/tests/tools.connection.test.ts`, `tools.issues.test.ts`

- [ ] **Step 1: Write handler unit tests with mocked `RedmineClient`**

```ts
it("test_connection returns connected user without api key", async () => {
  const client = {
    getCurrentUser: vi.fn().mockResolvedValue({ id: 1, login: "u", name: "User" }),
    config: { baseUrl: "https://redmine.example.com", apiKey: "SECRET" },
  };
  const result = await handleTestConnection(client as any);
  expect(result.connected).toBe(true);
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement server**

`logging.ts`: log only to `console.error` (stderr). Never `console.log`.

`server.ts` pattern (MCP SDK 1.x):
```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const INSTRUCTIONS = `Redmine read tools may be used without write confirmation.
Do not print API keys or credentials.
Phase 1 has no write tools; do not invent write operations.
Prefer redmine_search_issues with assignedTo=me for "my open issues".`;

export async function startServer() {
  const client = RedmineClient.fromEnv();
  const server = new Server(
    { name: "redmine", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [/* name, description, inputSchema for 4 tools */],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      // dispatch by name, validate schema, call handler
      // return { content: [{ type: "text", text: JSON.stringify(data) }] }
    } catch (e) {
      // map RedmineError to isError response with code + message + check + dataChanged + retrySafe
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => process.exit(0);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
```

`index.ts`:
```ts
#!/usr/bin/env node
import { startServer } from "./server.js";
startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Audit log line (stderr JSON): `timestamp`, `tool`, `host`, `userId?`, `ok`, `httpStatus?`, `durationMs`, `errorCode?` — never api key or bodies.

- [ ] **Step 4: Build and smoke with MCP Inspector (manual)**

Run:
```bash
pnpm --filter redmine-mcp build
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```
Expected: four tools listed; invalid input rejected; stdout not polluted when setting `REDMINE_LOG_LEVEL=debug`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(mcp): implement STDIO server with four read tools"
```

---

### Task 8: Docker Redmine + integration tests

**Files:**
- Create: `docker/redmine/docker-compose.yml`, `docker/redmine/README.md`
- Create: `packages/redmine-client/tests/integration/issues.integration.test.ts`
- Modify: root `package.json` scripts

- [ ] **Step 1: Add compose file**

`docker/redmine/docker-compose.yml`:
```yaml
services:
  redmine-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: redmine
      POSTGRES_USER: redmine
      POSTGRES_DB: redmine
    volumes:
      - redmine-pg:/var/lib/postgresql/data

  redmine:
    image: redmine:5.1.3
    ports:
      - "3000:3000"
    environment:
      REDMINE_DB_POSTGRES: redmine-db
      REDMINE_DB_DATABASE: redmine
      REDMINE_DB_USERNAME: redmine
      REDMINE_DB_PASSWORD: redmine
    depends_on:
      - redmine-db

volumes:
  redmine-pg:
```

Pin the image tag; update README with: enable REST API, create user + API key, create project + sample issues (including >100 if testing pagination — can seed via rake/API script).

- [ ] **Step 2: Document seed steps in `docker/redmine/README.md`**

Include env for tests:
```bash
export REDMINE_URL=http://localhost:3000
export REDMINE_API_KEY=...
export REDMINE_ALLOWED_HOSTS=localhost
```

- [ ] **Step 3: Write integration tests gated by env**

```ts
const enabled = process.env.REDMINE_INTEGRATION === "1";
describe.runIf(enabled)("redmine integration", () => {
  it("authenticates", async () => { /* getCurrentUser */ });
  it("rejects bad key", async () => { /* expect AUTHENTICATION */ });
  it("searches my open issues", async () => { /* searchIssues */ });
  it("gets issue with journals", async () => { /* getIssue */ });
});
```

Run without Docker: tests skipped. With Docker + `REDMINE_INTEGRATION=1`: PASS.

- [ ] **Step 4: Commit**

```bash
git add docker packages/redmine-client/tests/integration
git commit -m "test: add Docker Redmine compose and gated integration tests"
```

---

### Task 9: Claude Code plugin + skills

**Files:**
- Create: `plugins/claude-code/.claude-plugin/plugin.json`
- Create: `plugins/claude-code/.mcp.json`
- Create: `plugins/claude-code/skills/my-issues/SKILL.md`
- Create: `plugins/claude-code/skills/issue/SKILL.md`
- Create: `plugins/claude-code/README.md`

- [ ] **Step 1: Write manifests**

`plugin.json`:
```json
{
  "name": "redmine",
  "description": "Search and view Redmine issues from Claude Code.",
  "version": "0.1.0",
  "author": { "name": "M2I" },
  "license": "MIT"
}
```

`.mcp.json`:
```json
{
  "mcpServers": {
    "redmine": {
      "command": "npx",
      "args": ["-y", "redmine-mcp@0.1.0"],
      "env": {
        "REDMINE_URL": "${REDMINE_URL}",
        "REDMINE_API_KEY": "${REDMINE_API_KEY}"
      }
    }
  }
}
```

For local pre-publish testing, temporarily use:
```json
"command": "node",
"args": ["../../packages/redmine-mcp/dist/index.js"]
```
Document both modes in plugin README; publish mode must pin `redmine-mcp@0.1.0`.

- [ ] **Step 2: Write `my-issues/SKILL.md`**

```markdown
---
name: my-issues
description: List open Redmine issues assigned to me
---

# My open Redmine issues

Use MCP tools only. Never invent write operations.

1. If the user named a project, call `redmine_list_projects` with that search text and pick the best match (ask if ambiguous).
2. Call `redmine_search_issues` with:
   - `assignedTo`: `"me"`
   - `status`: `"open"`
   - `projectId` if resolved
   - reasonable `limit` (default 50)
3. Present a markdown table: `| ID | Subject | Status | Priority | Updated |`
4. On errors, show the tool error message; do not retry with different credentials.
```

- [ ] **Step 3: Write `issue/SKILL.md`**

```markdown
---
name: issue
description: Show Redmine issue detail and recent comments
---

# Redmine issue detail

1. Extract issue id from arguments or chat (`1523` or `#1523`). If missing, ask once for the issue number.
2. Call `redmine_get_issue` with `issueId` and `include: ["journals"]`.
3. Show: subject, project, tracker, status, priority, assignee, description (summary), then recent journals (author, date, notes).
4. Do not change issue fields or add comments.
```

- [ ] **Step 4: Manual smoke**

```bash
pnpm --filter redmine-mcp build
claude --plugin-dir ./plugins/claude-code
```
Expected: plugin listed; `/mcp` shows redmine; `/redmine:my-issues` and `/redmine:issue` available (with env set).

- [ ] **Step 5: Commit**

```bash
git add plugins/claude-code
git commit -m "feat(plugins): add Claude Code redmine plugin with read skills"
```

---

### Task 10: Codex plugin + skills

**Files:**
- Create: `plugins/codex/.codex-plugin/plugin.json`
- Create: `plugins/codex/.mcp.json`
- Create: `plugins/codex/skills/my-issues/SKILL.md`
- Create: `plugins/codex/skills/issue/SKILL.md`
- Create: `plugins/codex/README.md`

- [ ] **Step 1: Write Codex manifest**

`plugin.json`:
```json
{
  "name": "redmine",
  "version": "0.1.0",
  "description": "Search and view Redmine issues from Codex.",
  "author": { "name": "M2I" },
  "license": "MIT",
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "interface": {
    "displayName": "Redmine",
    "shortDescription": "View Redmine issues",
    "longDescription": "Search and view Redmine issues from Codex (read-only Phase 1).",
    "developerName": "M2I",
    "category": "Productivity",
    "capabilities": ["Read"]
  }
}
```

`.mcp.json` (direct server map):
```json
{
  "redmine": {
    "command": "npx",
    "args": ["-y", "redmine-mcp@0.1.0"],
    "env_vars": ["REDMINE_URL", "REDMINE_API_KEY", "REDMINE_CA_CERT_PATH"]
  }
}
```

Copy skill markdown from Claude plugin (keep behavior identical).

- [ ] **Step 2: Document approval policy snippet in README**

```toml
[plugins."redmine".mcp_servers.redmine]
enabled = true
default_tools_approval_mode = "prompt"

[plugins."redmine".mcp_servers.redmine.tools.redmine_test_connection]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_list_projects]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_search_issues]
approval_mode = "approve"
[plugins."redmine".mcp_servers.redmine.tools.redmine_get_issue]
approval_mode = "approve"
```

- [ ] **Step 3: Validate with plugin-creator script if available**

If Codex `validate_plugin.py` exists on the machine, run it against `plugins/codex`. Otherwise manual load smoke.

- [ ] **Step 4: Commit**

```bash
git add plugins/codex
git commit -m "feat(plugins): add Codex redmine plugin with read skills"
```

---

### Task 11: Docs + publish checklist

**Files:**
- Create: `docs/installation.md`, `docs/security.md`, `docs/troubleshooting.md`, `docs/development.md`
- Modify: root `README.md`
- Create: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```bash
REDMINE_URL=https://redmine.example.com
REDMINE_API_KEY=
REDMINE_ALLOWED_HOSTS=redmine.example.com
# REDMINE_CA_CERT_PATH=
# REDMINE_DEFAULT_PROJECT_ID=
```

- [ ] **Step 2: Write docs**

`installation.md`: enable REST API, create API key, set env, Claude `--plugin-dir`, Codex plugin load, slash examples `/redmine:my-issues`, `/redmine:issue 1523`, internal npm install of `redmine-mcp@0.1.0`.

`security.md`: no keys in git, allowlist, CA path, no SSL verify disable, audit log fields.

`troubleshooting.md`: auth errors, TLS, VPN, missing env, stdout pollution check.

`development.md`: pnpm build/test, Docker integration flag, Inspector command.

- [ ] **Step 3: Publish dry-run**

```bash
pnpm --filter redmine-client build
pnpm --filter redmine-mcp build
pnpm --filter redmine-client exec npm pack --dry-run
pnpm --filter redmine-mcp exec npm pack --dry-run
```
Expected: `dist/**` included; no `.env` or tests secrets.

Actual publish to internal registry (when credentials exist):
```bash
pnpm --filter redmine-client publish --registry <internal>
pnpm --filter redmine-mcp publish --registry <internal>
```

- [ ] **Step 4: Acceptance pass against spec §13**

Manually tick design checklist items; fix any gaps before tagging `v0.1.0`.

- [ ] **Step 5: Commit**

```bash
git add docs .env.example README.md
git commit -m "docs: add install, security, and development guides for Phase 1"
```

---

## Spec coverage (self-review)

| Spec area | Task(s) |
| --- | --- |
| Monorepo client + mcp + plugins | 1, 9, 10 |
| Four read tools | 4–7 |
| Schemas / additionalProperties false | 6 |
| Config, allowlist, local http exception | 2 |
| HTTP headers, timeout, GET retry | 3 |
| Pagination / maxResultCount | 5 |
| Error codes + stderr logging + SIGINT | 7 |
| Docker integration | 8 |
| Slash skills my-issues / issue | 9–10 |
| Docs + npm 0.1.0 | 11 |
| No write tools / no extra skills | enforced by Tasks 6–10 file list |

## Type/name consistency

- Package: `redmine-client`, `redmine-mcp`
- Class: `RedmineClient`, `RedmineHttp`, `RedmineError`
- Tools: `redmine_test_connection`, `redmine_list_projects`, `redmine_search_issues`, `redmine_get_issue`
- Skills: `my-issues`, `issue` → `/redmine:my-issues`, `/redmine:issue`
- Env: `REDMINE_URL`, `REDMINE_API_KEY`, `REDMINE_ALLOWED_HOSTS`, `REDMINE_CA_CERT_PATH`, …
