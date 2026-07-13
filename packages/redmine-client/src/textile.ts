/**
 * This Redmine instance stores issue bodies as HTML (not Textile).
 * Plain-text newlines are collapsed; convert to HTML so multi-line text renders.
 */

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text.trim());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Comments/journals: append <br /> per line (works when notes accept HTML breaks).
 * Idempotent if a line already ends with <br>.
 */
export function formatNotesForRedmine(notes: string): string {
  const normalized = normalizeNewlines(notes);
  return normalized
    .split("\n")
    .map((line) => {
      const trimmedEnd = line.replace(/\s+$/u, "");
      if (/<br\s*\/?>\s*$/i.test(trimmedEnd)) return trimmedEnd;
      return `${trimmedEnd}<br />`;
    })
    .join("\n");
}

/**
 * Issue description: wrap each non-empty line in <p>...</p>.
 * Leaves content unchanged when it already looks like HTML.
 */
export function formatDescriptionForRedmine(description: string): string {
  const normalized = normalizeNewlines(description);
  if (!normalized.trim()) return normalized;
  if (looksLikeHtml(normalized)) return normalized;

  return normalized
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
    .join("\n");
}
