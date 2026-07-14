import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename } from "node:path";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  type AttachmentInput,
  type AttachmentPreview,
  type UploadedAttachment,
} from "./types.js";

export function inspectAttachments(
  inputs: AttachmentInput[]
): AttachmentPreview[] {
  if (inputs.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "attachments must be a non-empty array when provided",
      check: ["Pass at least one attachment"],
    });
  }
  if (inputs.length > ATTACHMENT_MAX_FILES) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `At most ${ATTACHMENT_MAX_FILES} attachments per request`,
      check: [`Reduce attachments to ≤ ${ATTACHMENT_MAX_FILES}`],
    });
  }
  return inputs.map((input) => {
    let resolved: string;
    try {
      resolved = realpathSync(input.path);
    } catch {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment not found: ${basename(input.path)}`,
        check: ["Check the file path exists on the MCP host"],
      });
    }
    const st = statSync(resolved);
    if (!st.isFile()) {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment is not a regular file: ${basename(resolved)}`,
        check: ["Pass a file path, not a directory"],
      });
    }
    if (st.size > ATTACHMENT_MAX_BYTES) {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Attachment exceeds ${ATTACHMENT_MAX_BYTES} bytes: ${basename(resolved)}`,
        check: ["Use a smaller file (max 10 MiB)"],
      });
    }
    const filename = input.filename?.trim() || basename(resolved);
    return {
      path: resolved,
      filename,
      sizeBytes: st.size,
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    };
  });
}

export async function uploadFile(
  http: RedmineHttp,
  input: AttachmentInput
): Promise<UploadedAttachment> {
  const [preview] = inspectAttachments([input]);
  const buf = readFileSync(preview.path);
  const data = await http.postBinary<{ upload: { token: string } }>(
    "/uploads.json",
    buf,
    { "Content-Type": "application/octet-stream" },
    { filename: preview.filename }
  );
  if (!data?.upload?.token) {
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: "Redmine upload returned no token",
      check: ["Retry upload", "Check Redmine file size limits"],
    });
  }
  return {
    token: data.upload.token,
    filename: preview.filename,
    sizeBytes: preview.sizeBytes,
    ...(preview.description !== undefined
      ? { description: preview.description }
      : {}),
  };
}

export async function uploadAttachments(
  http: RedmineHttp,
  inputs: AttachmentInput[]
): Promise<UploadedAttachment[]> {
  const previews = inspectAttachments(inputs);
  const out: UploadedAttachment[] = [];
  for (const p of previews) {
    out.push(
      await uploadFile(http, {
        path: p.path,
        filename: p.filename,
        description: p.description,
      })
    );
  }
  return out;
}
