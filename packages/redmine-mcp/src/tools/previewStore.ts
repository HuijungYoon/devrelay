import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { RedmineError } from "redmine-devrelay-client";

export type PreviewTool =
  | "redmine_create_issue"
  | "redmine_update_issue"
  | "redmine_add_comment"
  | "redmine_add_attachment"
  | "redmine_update_status"
  | "redmine_add_issue_relation"
  | "redmine_update_issue_relation"
  | "redmine_remove_issue_relation"
  | "redmine_log_time"
  | "redmine_bulk_update_status";

type PreviewEntry = {
  tool: PreviewTool;
  payloadHash: string;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;

/** Map과 같은 모양. 프로세스 안(Map) 또는 디렉터리(파일 하나 = 토큰 하나) */
type TokenStore = {
  get(token: string): PreviewEntry | undefined;
  set(token: string, entry: PreviewEntry): void;
  delete(token: string): boolean;
  clear(): void;
};

function memoryStore(): TokenStore {
  const map = new Map<string, PreviewEntry>();
  return {
    get: (t) => map.get(t),
    set: (t, e) => void map.set(t, e),
    delete: (t) => map.delete(t),
    clear: () => map.clear(),
  };
}

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

/**
 * HTTP 모드에서 프로세스를 여러 개 띄우면 메모리 Map은 프로세스마다 따로라서 dry-run과
 * confirm이 다른 프로세스에 떨어지면 토큰을 못 찾는다. 같은 호스트(또는 공유 볼륨)의
 * 디렉터리에 토큰마다 파일을 두면 어느 프로세스가 받아도 검증·소비할 수 있다.
 * 1회용은 unlink로 보장한다 — 두 프로세스가 동시에 소비하면 한쪽의 unlink가 ENOENT로 진다.
 */
function fileStore(dir: string): TokenStore {
  mkdirSync(dir, { recursive: true });
  const pathOf = (token: string) => {
    if (!TOKEN_RE.test(token)) return null; // 경로로 장난치는 토큰은 없는 토큰
    return join(dir, `${token}.json`);
  };
  const sweep = () => {
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const p = join(dir, name);
      try {
        const e = JSON.parse(readFileSync(p, "utf8")) as PreviewEntry;
        if (e.expiresAt < now) unlinkSync(p);
      } catch {
        /* 깨진 파일은 다음 sweep에서 다시 본다 */
      }
    }
  };
  return {
    get: (t) => {
      const p = pathOf(t);
      if (!p) return undefined;
      try {
        return JSON.parse(readFileSync(p, "utf8")) as PreviewEntry;
      } catch {
        return undefined;
      }
    },
    set: (t, e) => {
      sweep();
      const p = pathOf(t);
      if (!p) return;
      writeFileSync(p, JSON.stringify(e));
    },
    delete: (t) => {
      const p = pathOf(t);
      if (!p) return false;
      try {
        unlinkSync(p);
        return true;
      } catch {
        return false;
      }
    },
    clear: () => {
      for (const name of readdirSync(dir)) {
        if (name.endsWith(".json")) {
          try {
            unlinkSync(join(dir, name));
          } catch {
            /* already gone */
          }
        }
      }
    },
  };
}

function createStore(dir: string | undefined): TokenStore {
  return dir && dir.trim() ? fileStore(dir.trim()) : memoryStore();
}

let store: TokenStore = createStore(process.env.REDMINE_PREVIEW_STORE_DIR);

/**
 * 저장소를 바꾼다 (테스트, 또는 HTTP 서버가 설정으로 디렉터리를 정할 때).
 * dir이 없으면 메모리로 돌아간다.
 */
export function configurePreviewStore(opts: { dir?: string } = {}): void {
  store = createStore(opts.dir);
}

export function clearPreviewStore(): void {
  store.clear();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = stableValue(obj[key]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON of write args excluding confirm/previewToken. */
export function canonicalPayload(input: Record<string, unknown>): string {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "confirm" || key === "previewToken") continue;
    rest[key] = value;
  }
  return JSON.stringify(stableValue(rest));
}

export function hashPayload(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

export function issuePreviewToken(
  tool: PreviewTool,
  input: Record<string, unknown>
): string {
  const payloadHash = hashPayload(canonicalPayload(input));
  const token = randomUUID();
  store.set(token, {
    tool,
    payloadHash,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function consumePreviewToken(
  tool: PreviewTool,
  token: string | undefined,
  input: Record<string, unknown>
): void {
  if (!token) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message:
        "confirm=true requires previewToken from a prior dry-run of the same payload",
      check: [
        "Call the tool with confirm omitted/false first",
        "Show the dry-run preview to the user",
        "After approval, retry with confirm:true and the returned previewToken",
      ],
    });
  }

  const entry = store.get(token);
  if (!entry) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "previewToken is unknown or already used",
      check: [
        "Run a fresh dry-run to get a new previewToken",
        "Do not reuse a token after a successful confirm",
      ],
    });
  }

  if (entry.expiresAt < Date.now()) {
    store.delete(token);
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "previewToken expired (TTL 10 minutes)",
      check: ["Run dry-run again and confirm promptly"],
    });
  }

  if (entry.tool !== tool) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `previewToken tool mismatch: expected ${entry.tool}, got ${tool}`,
      check: ["Use the previewToken with the same write tool that issued it"],
    });
  }

  const payloadHash = hashPayload(canonicalPayload(input));
  if (payloadHash !== entry.payloadHash) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "confirm payload does not match dry-run previewToken",
      check: [
        "Keep all fields identical to the dry-run (except confirm/previewToken)",
        "If you change notes or fields, dry-run again",
      ],
    });
  }

  if (!store.delete(token)) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "previewToken is unknown or already used",
      check: [
        "Run a fresh dry-run to get a new previewToken",
        "Do not reuse a token after a successful confirm",
      ],
    });
  }
}

export function asPayload(input: object): Record<string, unknown> {
  return input as Record<string, unknown>;
}

/** Attach a fresh previewToken to a dry-run payload. */
export function withIssuedToken<T extends Record<string, unknown>>(
  tool: PreviewTool,
  input: object,
  preview: T
): T & { previewToken: string } {
  return {
    ...preview,
    previewToken: issuePreviewToken(tool, asPayload(input)),
  };
}

/** Consume the token when the caller passed confirm=true. */
export function consumeIfConfirm(
  tool: PreviewTool,
  input: { confirm?: boolean; previewToken?: string }
): void {
  if (input.confirm) {
    consumePreviewToken(tool, input.previewToken, asPayload(input));
  }
}
