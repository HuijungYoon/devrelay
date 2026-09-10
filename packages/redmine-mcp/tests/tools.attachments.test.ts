import { describe, it, expect, vi } from "vitest";
import { handleGetAttachment } from "../src/tools/attachments.js";
import { safeParseGetAttachment } from "../src/tools/schemas.js";

const DOWNLOADED = {
  attachment: {
    id: 13291,
    filename: "notes.txt",
    filesize: 11,
    contentType: "text/plain",
    description: "메모",
    contentUrl: "http://192.168.1.20/redmine/attachments/download/13291/notes.txt",
    author: { id: 164, name: "윤 희중" },
    createdOn: "2026-07-20T00:45:15Z",
  },
  path: "C:\\tmp\\notes.txt",
  sizeBytes: 11,
  contentType: "text/plain",
  text: "hello world",
};

describe("redmine_get_attachment", () => {
  it("passes the options through and flattens the result", async () => {
    const downloadAttachment = vi.fn().mockResolvedValue(DOWNLOADED);
    const result = await handleGetAttachment(
      { downloadAttachment } as never,
      { attachmentId: 13291, destDir: "C:\\tmp", maxBytes: 1024 }
    );
    expect(downloadAttachment).toHaveBeenCalledWith({
      attachmentId: 13291,
      destDir: "C:\\tmp",
      maxBytes: 1024,
    });
    expect(result).toMatchObject({
      attachmentId: 13291,
      filename: "notes.txt",
      path: "C:\\tmp\\notes.txt",
      sizeBytes: 11,
      contentType: "text/plain",
      description: "메모",
      text: "hello world",
    });
    expect(result.hint).toBeUndefined();
  });

  it("adds a reader hint for binary files", async () => {
    const downloadAttachment = vi
      .fn()
      .mockResolvedValue({ ...DOWNLOADED, text: undefined, contentType: "image/png" });
    const result = await handleGetAttachment(
      { downloadAttachment } as never,
      { attachmentId: 13291 }
    );
    expect(result.text).toBeUndefined();
    expect(result.hint).toMatch(/file reader/);
  });

  it("schema requires attachmentId and caps maxBytes at 50 MiB", () => {
    expect(safeParseGetAttachment({}).success).toBe(false);
    expect(safeParseGetAttachment({ attachmentId: 1 }).success).toBe(true);
    expect(
      safeParseGetAttachment({ attachmentId: 1, maxBytes: 50 * 1024 * 1024 })
        .success
    ).toBe(true);
    expect(
      safeParseGetAttachment({ attachmentId: 1, maxBytes: 50 * 1024 * 1024 + 1 })
        .success
    ).toBe(false);
    expect(
      safeParseGetAttachment({ attachmentId: 1, destDir: "" }).success
    ).toBe(false);
    expect(safeParseGetAttachment({ attachmentId: 1, hack: 1 }).success).toBe(
      false
    );
  });
});
