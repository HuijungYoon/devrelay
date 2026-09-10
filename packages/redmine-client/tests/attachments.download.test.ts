import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  downloadAttachment,
  getAttachment,
  looksLikeText,
  safeAttachmentFilename,
} from "../src/attachments.js";
import { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "http://192.168.1.20/redmine",
  apiKey: "secret-key",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.8.0",
};

const META = {
  attachment: {
    id: 13291,
    filename: "spec/../notes.txt",
    filesize: 11,
    description: "메모",
    content_url: "http://192.168.1.20/redmine/attachments/download/13291/notes.txt",
    author: { id: 164, name: "윤 희중" },
    created_on: "2026-07-20T00:45:15Z",
  },
};

function fakeHttp(overrides: Record<string, unknown> = {}) {
  return {
    getJson: vi.fn().mockResolvedValue(META),
    getBinary: vi.fn().mockResolvedValue({
      bytes: Buffer.from("hello world"),
      contentType: "text/plain; charset=utf-8",
    }),
    ...overrides,
  } as unknown as RedmineHttp;
}

describe("attachment download", () => {
  let dir: string;
  beforeEach(() => {
    vi.restoreAllMocks();
    dir = mkdtempSync(join(tmpdir(), "rd-dl-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("getAttachment normalizes metadata and tolerates a missing content_type", async () => {
    const http = fakeHttp();
    const info = await getAttachment(http, 13291);
    expect(http.getJson).toHaveBeenCalledWith("/attachments/13291.json");
    expect(info).toMatchObject({
      id: 13291,
      filename: "spec/../notes.txt",
      filesize: 11,
      contentType: null,
      description: "메모",
      author: { id: 164, name: "윤 희중" },
    });
  });

  it("saves the file under a sanitized name and inlines text", async () => {
    const http = fakeHttp();
    const result = await downloadAttachment(http, {
      attachmentId: 13291,
      destDir: dir,
    });
    expect(http.getBinary).toHaveBeenCalledWith(META.attachment.content_url, {
      maxBytes: 10 * 1024 * 1024,
    });
    expect(result.path).toBe(join(dir, "notes.txt"));
    expect(readFileSync(result.path, "utf8")).toBe("hello world");
    expect(result.text).toBe("hello world");
    expect(result.textTruncated).toBeUndefined();
    expect(result.contentType).toBe("text/plain; charset=utf-8");
  });

  it("does not overwrite an existing file in a caller-chosen folder", async () => {
    writeFileSync(join(dir, "notes.txt"), "keep me");
    const result = await downloadAttachment(fakeHttp(), {
      attachmentId: 13291,
      destDir: dir,
    });
    expect(result.path).toBe(join(dir, "notes-13291.txt"));
    expect(readFileSync(join(dir, "notes.txt"), "utf8")).toBe("keep me");
    expect(existsSync(result.path)).toBe(true);
  });

  it("skips inline text for binary content and when inlineText=false", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const http = fakeHttp({
      getJson: vi.fn().mockResolvedValue({
        attachment: { ...META.attachment, filename: "shot.png", filesize: 8 },
      }),
      getBinary: vi.fn().mockResolvedValue({ bytes: png, contentType: "image/png" }),
    });
    const image = await downloadAttachment(http, { attachmentId: 1, destDir: dir });
    expect(image.text).toBeUndefined();
    expect(image.path).toBe(join(dir, "shot.png"));

    const text = await downloadAttachment(fakeHttp(), {
      attachmentId: 13291,
      destDir: dir,
      inlineText: false,
    });
    expect(text.text).toBeUndefined();
  });

  it("refuses a file whose declared size is over the limit before fetching it", async () => {
    const http = fakeHttp({
      getJson: vi.fn().mockResolvedValue({
        attachment: { ...META.attachment, filesize: 20 * 1024 * 1024 },
      }),
    });
    await expect(
      downloadAttachment(http, { attachmentId: 13291, destDir: dir })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(http.getBinary).not.toHaveBeenCalled();

    // caller may raise the limit up to the hard cap
    const ok = await downloadAttachment(http, {
      attachmentId: 13291,
      destDir: dir,
      maxBytes: 30 * 1024 * 1024,
    });
    expect(ok.path).toBe(join(dir, "notes.txt"));
  });

  it("safeAttachmentFilename strips paths and reserved characters", () => {
    expect(safeAttachmentFilename("..\\..\\evil:name?.txt", 5)).toBe("evil_name_.txt");
    expect(safeAttachmentFilename("...", 5)).toBe("attachment-5");
    expect(safeAttachmentFilename("프로그레스바 미리보기.TDS2", 5)).toBe("프로그레스바 미리보기.TDS2");
  });

  it("looksLikeText uses type, then extension, and rejects NUL bytes", () => {
    expect(looksLikeText("a.bin", "text/plain", Buffer.from("x"))).toBe(true);
    expect(looksLikeText("a.md", null, Buffer.from("# hi"))).toBe(true);
    expect(looksLikeText("a.TDS2", null, Buffer.from("x"))).toBe(false);
    expect(looksLikeText("a.txt", null, Buffer.from([0x41, 0, 0x42]))).toBe(false);
  });
});

describe("RedmineHttp.getBinary", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches with Accept */* and returns bytes + content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Buffer.from("abc"), {
        status: 200,
        headers: { "content-type": "text/plain", "content-length": "3" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(config);
    const result = await http.getBinary(
      "http://192.168.1.20/redmine/attachments/download/1/a.txt",
      { maxBytes: 1024 }
    );
    expect(result.bytes.toString()).toBe("abc");
    expect(result.contentType).toBe("text/plain");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.1.20/redmine/attachments/download/1/a.txt");
    expect(init.headers["Accept"]).toBe("*/*");
    expect(init.headers["X-Redmine-API-Key"]).toBe("secret-key");
  });

  it("refuses URLs on another host or outside the base path without sending the key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const http = new RedmineHttp(config);
    await expect(
      http.getBinary("http://evil.example.com/redmine/attachments/download/1/a", {
        maxBytes: 1024,
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    await expect(
      http.getBinary("http://192.168.1.20/other/attachments/download/1/a", {
        maxBytes: 1024,
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops on Content-Length over the limit and on an oversized body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Buffer.from("abcdef"), {
          status: 200,
          headers: { "content-length": "6" },
        })
      )
    );
    const http = new RedmineHttp(config);
    await expect(
      http.getBinary("http://192.168.1.20/redmine/attachments/download/1/a", {
        maxBytes: 5,
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(Buffer.from("abcdef"), { status: 200 }))
    );
    await expect(
      http.getBinary("http://192.168.1.20/redmine/attachments/download/1/a", {
        maxBytes: 5,
      })
    ).rejects.toMatchObject({ code: "REDMINE_VALIDATION_ERROR" });
  });

  it("maps a 403 on the download to PERMISSION_DENIED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 403 }))
    );
    const http = new RedmineHttp(config);
    await expect(
      http.getBinary("http://192.168.1.20/redmine/attachments/download/1/a", {
        maxBytes: 5,
      })
    ).rejects.toMatchObject({ code: "REDMINE_PERMISSION_DENIED" });
  });
});
