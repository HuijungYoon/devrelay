import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  inspectAttachments,
  uploadFile,
} from "../src/attachments.js";
import type { RedmineHttp } from "../src/http.js";

describe("attachments", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("inspectAttachments returns basename and size", () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-"));
    const p = join(dir, "a.txt");
    writeFileSync(p, "hello");
    const previews = inspectAttachments([{ path: p }]);
    expect(previews[0]).toMatchObject({
      filename: "a.txt",
      sizeBytes: 5,
    });
    rmSync(dir, { recursive: true });
  });

  it("inspectAttachments rejects more than 5 files", () => {
    expect(() =>
      inspectAttachments(
        Array.from({ length: 6 }, (_, i) => ({ path: `/nope/${i}` }))
      )
    ).toThrow(/5/);
  });

  it("uploadFile POSTs octet-stream with filename query", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-"));
    const p = join(dir, "shot.png");
    writeFileSync(p, Buffer.from([1, 2, 3]));
    const postBinary = vi.fn().mockResolvedValue({
      upload: { token: "tok.1", id: 1 },
    });
    const http = { postBinary } as unknown as RedmineHttp;
    const out = await uploadFile(http, { path: p });
    expect(postBinary).toHaveBeenCalledWith(
      "/uploads.json",
      expect.any(Buffer),
      expect.objectContaining({
        "Content-Type": "application/octet-stream",
      }),
      { filename: "shot.png" }
    );
    expect(out.token).toBe("tok.1");
    rmSync(dir, { recursive: true });
  });
});
