/**
 * Redmine Textile (and some HTML-ish note UIs) collapse bare newlines.
 * Convert line breaks to <br /> so multi-line comments render as intended.
 * Idempotent for lines that already end with <br /> / <br>.
 */
export function formatNotesForRedmine(notes: string): string {
  const normalized = notes.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => {
      const trimmedEnd = line.replace(/\s+$/u, "");
      if (/<br\s*\/?>\s*$/i.test(trimmedEnd)) return trimmedEnd;
      return `${trimmedEnd}<br />`;
    })
    .join("\n");
}
