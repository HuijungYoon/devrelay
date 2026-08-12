function header(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim();
  return raw?.trim();
}

export function parseByokHeaders(
  headers: Record<string, string | string[] | undefined>
): { baseUrl: string; apiKey: string } {
  const baseUrl = header(headers, "x-redmine-url");
  const apiKey = header(headers, "x-redmine-api-key");
  if (!baseUrl || !apiKey) {
    throw new Error(
      "BYOK required: set X-Redmine-Url and X-Redmine-Api-Key headers"
    );
  }
  return { baseUrl, apiKey };
}
