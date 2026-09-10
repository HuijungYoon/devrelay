import type { RedmineClient } from "redmine-devrelay-client";
import type { GetAttachmentInput } from "./schemas.js";

/**
 * 첨부를 내려받아 로컬 경로(+ 텍스트면 본문)를 돌려준다. Redmine을 바꾸지 않는
 * 읽기 도구라 confirm 게이트가 없다. 크기 상한과 같은 호스트 검사는 클라이언트가 한다.
 */
export async function handleGetAttachment(
  client: RedmineClient,
  input: GetAttachmentInput
) {
  const result = await client.downloadAttachment({
    attachmentId: input.attachmentId,
    ...(input.destDir !== undefined ? { destDir: input.destDir } : {}),
    ...(input.maxBytes !== undefined ? { maxBytes: input.maxBytes } : {}),
    ...(input.inlineText !== undefined ? { inlineText: input.inlineText } : {}),
  });
  return {
    attachmentId: result.attachment.id,
    filename: result.attachment.filename,
    path: result.path,
    sizeBytes: result.sizeBytes,
    contentType: result.contentType,
    description: result.attachment.description,
    author: result.attachment.author,
    createdOn: result.attachment.createdOn,
    ...(result.text !== undefined ? { text: result.text } : {}),
    ...(result.textTruncated ? { textTruncated: true } : {}),
    // 이미지·PDF·오피스 파일은 path를 Read 도구로 열어 보라는 힌트
    ...(result.text === undefined
      ? { hint: "Binary file saved locally — open `path` with a file reader (images render, PDFs need a PDF reader)" }
      : {}),
  };
}
