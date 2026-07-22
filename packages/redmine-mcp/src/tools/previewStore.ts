import { createHash, randomUUID } from "node:crypto";
import { RedmineError } from "redmine-devrelay-client";

export type PreviewTool =
  | "redmine_create_issue"
  | "redmine_update_issue"
  | "redmine_add_comment"
  | "redmine_add_attachment"
  | "redmine_update_status";

type PreviewEntry = {
  tool: PreviewTool;
  payloadHash: string;
  expiresAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, PreviewEntry>();

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

  store.delete(token);
}
