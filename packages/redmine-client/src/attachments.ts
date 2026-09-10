import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import {
  ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES,
  ATTACHMENT_DOWNLOAD_MAX_BYTES,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  ATTACHMENT_TEXT_INLINE_MAX_BYTES,
  type AttachmentInfo,
  type AttachmentInput,
  type AttachmentPreview,
  type DownloadAttachmentInput,
  type DownloadAttachmentResult,
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

type RawAttachment = {
  id: number;
  filename?: string;
  filesize?: number;
  content_type?: string | null;
  description?: string | null;
  content_url?: string;
  author?: { id: number; name: string } | null;
  created_on?: string | null;
};

export function normalizeAttachment(raw: RawAttachment): AttachmentInfo {
  return {
    id: raw.id,
    filename: raw.filename ?? `attachment-${raw.id}`,
    filesize: raw.filesize ?? 0,
    contentType: raw.content_type ?? null,
    description: raw.description ?? "",
    contentUrl: raw.content_url ?? "",
    author: raw.author ?? null,
    createdOn: raw.created_on ?? null,
  };
}

/** 첨부 메타데이터 (GET /attachments/:id.json) */
export async function getAttachment(
  http: RedmineHttp,
  attachmentId: number
): Promise<AttachmentInfo> {
  const data = await http.getJson<{ attachment?: RawAttachment }>(
    `/attachments/${attachmentId}.json`
  );
  if (!data?.attachment) {
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: `Attachment #${attachmentId} returned no metadata`,
      check: ["Check the attachment id from redmine_get_issue include=[\"attachments\"]"],
    });
  }
  return normalizeAttachment(data.attachment);
}

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".log", ".csv", ".tsv", ".json", ".xml",
  ".yml", ".yaml", ".ini", ".cfg", ".conf", ".toml", ".sql", ".html", ".htm",
  ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rb", ".sh",
  ".ps1", ".bat", ".java", ".kt", ".c", ".h", ".cpp", ".hpp", ".cs", ".go",
  ".rs", ".php", ".env", ".properties", ".diff", ".patch",
]);

/** Windows에서도 안전한 파일 이름: 경로 구분자·제어문자·예약문자 제거 */
export function safeAttachmentFilename(name: string, id: number): string {
  const base = basename(name.replace(/[\\/]+/g, "/"))
    .replace(/[\x00-\x1f<>:"|?*]/g, "_")
    .replace(/^\.+$/, "")
    .trim();
  return base || `attachment-${id}`;
}

export function looksLikeText(
  filename: string,
  contentType: string | null,
  bytes: Buffer
): boolean {
  const type = (contentType ?? "").toLowerCase();
  const byType =
    type.startsWith("text/") ||
    /(json|xml|yaml|csv|javascript|x-sh|x-httpd-php)/.test(type);
  const byExt = TEXT_EXTENSIONS.has(extname(filename).toLowerCase());
  if (!byType && !byExt) return false;
  // 확장자가 거짓말을 해도 NUL 바이트가 있으면 바이너리
  const probe = bytes.subarray(0, Math.min(bytes.length, 8192));
  return !probe.includes(0);
}

/**
 * 첨부를 내려받아 로컬에 저장한다. 텍스트면 본문도 함께 돌려준다.
 * 이미 같은 이름이 있으면 덮어쓰지 않고 "-<id>"를 붙인다.
 */
export async function downloadAttachment(
  http: RedmineHttp,
  input: DownloadAttachmentInput
): Promise<DownloadAttachmentResult> {
  const maxBytes = Math.min(
    input.maxBytes ?? ATTACHMENT_DOWNLOAD_MAX_BYTES,
    ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES
  );
  const attachment = await getAttachment(http, input.attachmentId);
  if (attachment.filesize > maxBytes) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Attachment "${attachment.filename}" is ${attachment.filesize} bytes, over the ${maxBytes} byte limit`,
      retrySafe: false,
      check: [
        `Pass maxBytes up to ${ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES} to allow it`,
        "Or open the file in Redmine directly",
      ],
    });
  }
  if (!attachment.contentUrl) {
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: `Attachment #${attachment.id} has no content_url`,
      check: ["Check that the API user may view files in this project"],
    });
  }

  const { bytes, contentType } = await http.getBinary(attachment.contentUrl, {
    maxBytes,
  });

  const destDir =
    input.destDir ??
    join(tmpdir(), "redmine-devrelay", "attachments", String(attachment.id));
  mkdirSync(destDir, { recursive: true });
  const safeName = safeAttachmentFilename(attachment.filename, attachment.id);
  let target = join(destDir, safeName);
  if (input.destDir !== undefined && existsSync(target)) {
    const ext = extname(safeName);
    const stem = ext ? safeName.slice(0, -ext.length) : safeName;
    target = join(destDir, `${stem}-${attachment.id}${ext}`);
  }
  writeFileSync(target, bytes);

  const resolvedType = attachment.contentType ?? contentType;
  const result: DownloadAttachmentResult = {
    attachment: { ...attachment, contentType: resolvedType },
    path: target,
    sizeBytes: bytes.length,
    contentType: resolvedType,
  };
  if (
    input.inlineText !== false &&
    looksLikeText(attachment.filename, resolvedType, bytes)
  ) {
    const slice = bytes.subarray(
      0,
      Math.min(bytes.length, ATTACHMENT_TEXT_INLINE_MAX_BYTES)
    );
    result.text = slice.toString("utf8").replace(/^\uFEFF/, "");
    if (bytes.length > ATTACHMENT_TEXT_INLINE_MAX_BYTES) {
      result.textTruncated = true;
    }
  }
  return result;
}
