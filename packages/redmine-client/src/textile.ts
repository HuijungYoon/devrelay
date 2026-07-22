/**
 * This Redmine instance stores issue bodies as HTML (not Textile).
 * Plain-text newlines are collapsed; convert to HTML so multi-line text renders.
 * Journal notes must stay plain text — no Textile/Markdown markup.
 */

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const NOTES_MARKUP_RULES: Array<{ label: string; test: (line: string) => boolean }> = [
  { label: "h1.", test: (l) => /^h1\.\s/i.test(l) },
  { label: "h2.", test: (l) => /^h2\.\s/i.test(l) },
  { label: "h3.", test: (l) => /^h3\.\s/i.test(l) },
  { label: "h4.", test: (l) => /^h4\.\s/i.test(l) },
  { label: "h5.", test: (l) => /^h5\.\s/i.test(l) },
  { label: "h6.", test: (l) => /^h6\.\s/i.test(l) },
  { label: "bq.", test: (l) => /^bq\.\s/i.test(l) },
  { label: "fn.", test: (l) => /^fn\d+\.\s/i.test(l) },
  { label: "** ", test: (l) => /^\*\*\s/.test(l) },
  { label: "* ", test: (l) => /^\*\s/.test(l) },
  // Markdown ATX / Textile numbered list — not issue refs like "#23839"
  { label: "# ", test: (l) => /^#{1,6}\s+\S/.test(l) },
  { label: "- ", test: (l) => /^-\s+\S/.test(l) },
  { label: "**bold**", test: (l) => /\*\*[^*\n]+\*\*/.test(l) },
  {
    label: "*italic*",
    test: (l) =>
      /(^|[\s(])\*[^*\s][^*\n]*\*(?=[\s).,!?:;]|$)/.test(l),
  },
];

/**
 * Returns labels of Textile/Markdown patterns found in notes.
 * Empty array = plain text OK. Issue refs like `#123` mid-line are allowed.
 */
export function detectNotesMarkup(notes: string): string[] {
  const normalized = normalizeNewlines(notes);
  const found = new Set<string>();
  for (const line of normalized.split("\n")) {
    const trimmed = line.trimStart();
    for (const rule of NOTES_MARKUP_RULES) {
      if (rule.test(trimmed)) found.add(rule.label);
    }
  }
  return [...found];
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
