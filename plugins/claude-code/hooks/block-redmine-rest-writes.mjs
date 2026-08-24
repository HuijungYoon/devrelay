/**
 * Guard: refuse to write to Redmine over raw REST.
 *
 * Raw writes bypass the redmine-devrelay dry-run -> previewToken -> confirm
 * gate, and every time it happened the issue body had to be repaired by hand
 * (this Redmine stores bodies as HTML).
 *
 * Two matchers, because the incident had two steps:
 *   Write|Edit - a script gets written that POSTs to Redmine. Judged by content.
 *   Bash       - curl/python invoked inline. Judged by the command line.
 *
 * Reads are never blocked, and scripts/redmine-call.mjs is allowed: it drives
 * the real MCP server, so the gate still applies.
 */
const REDMINE_TARGET =
  /(redmine[^\s'"]*\/(issues|relations|projects|uploads)|\/(issues|relations|uploads)(\/\d+)?\.json|\/issues\/\d+\/relations)/i;

/** HTTP write verbs. Only meaningful next to a Redmine target. */
const REST_VERB = [
  /-X\s*['"]?(POST|PUT|DELETE|PATCH)/i,
  /--request\s*['"]?(POST|PUT|DELETE|PATCH)/i,
  /requests\.(post|put|delete|patch)\s*\(/i,
  /session\.(post|put|delete|patch)\s*\(/i,
  /\bmethod\s*[:=]\s*['"](POST|PUT|DELETE|PATCH)['"]/i,
  /urlopen\s*\([^)]*data\s*=/,
  /Invoke-(RestMethod|WebRequest)[^|;]*-Method\s*['"]?(Post|Put|Delete|Patch)/i,
];

/** This client's own write methods — specific enough to count on their own. */
const CLIENT_METHOD =
  /\.(postJson|putJson|deleteJson|postBinary)\s*\(|\b(createIssue|updateIssue|addComment|updateIssueStatus|addIssueAttachments|addIssueRelation|removeIssueRelation|replaceIssueRelation)\s*\(/;

/**
 * Runners whose quoted argument IS code: the separators inside it are not shell
 * separators, so such a command has to be judged as a whole.
 */
const INLINE_CODE =
  /\b(python3?|py|node|bun|deno)\s+(-c|-e|--eval|eval)\b|\b(pwsh|powershell)\s+(-c|-Command)\b/i;

/** Clients that actually perform a request when they lead a command. */
const CLIENT_WORD =
  /^(curl|wget|http|https|httpie|python3?|py|node|bun|deno|pwsh|powershell|Invoke-RestMethod|Invoke-WebRequest)$/i;

const ALLOWED = /redmine-call\.mjs|block-redmine-rest-writes/i;

const hasRestVerb = (text) => REST_VERB.some((re) => re.test(text));

const writesRedmine = (text) =>
  (REDMINE_TARGET.test(text) && hasRestVerb(text)) || CLIENT_METHOD.test(text);

/**
 * A shell command counts only when a real client leads one of its segments, so
 * `echo '{"cmd":"curl -X POST /issues/1.json"}' | node check.mjs` is left alone
 * while `curl -X POST .../issues/1.json` is not.
 */
function bashWritesToRedmine(command) {
  if (ALLOWED.test(command)) return false;
  if (INLINE_CODE.test(command) && writesRedmine(command)) return true;

  for (const rawSegment of command.split(/\|\||&&|[|;\n]/)) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const firstWord = (segment.match(/^[^\s]+/) || [''])[0].replace(/^.*[\\/]/, '');
    if (CLIENT_WORD.test(firstWord) && writesRedmine(segment)) return true;
  }
  return false;
}

/** A Redmine path is required here: app code may legitimately define addComment(). */
function fileWritesToRedmine(content) {
  if (!content || ALLOWED.test(content)) return false;
  return (
    REDMINE_TARGET.test(content) &&
    (hasRestVerb(content) || CLIENT_METHOD.test(content))
  );
}

const REASON = [
  'Redmine 쓰기를 REST로 직접 하려는 것이라 막았습니다.',
  'dry-run -> previewToken -> confirm 게이트를 우회하게 되고, 과거에 본문이 한 덩어리로 저장돼 다시 고친 적이 있습니다.',
  'redmine_* MCP 도구를 쓰세요. 도구가 세션에 없으면 게이트가 살아 있는 헬퍼로:',
  "node <repo>/scripts/redmine-call.mjs <tool> '<json>'",
  '조회(GET)는 막지 않습니다.',
].join(' ');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    process.exit(0); // never block because the guard itself failed
  }

  const toolInput = payload.tool_input || {};
  const blocked =
    payload.tool_name === 'Bash'
      ? bashWritesToRedmine(String(toolInput.command || ''))
      : fileWritesToRedmine(String(toolInput.content || toolInput.new_string || ''));

  if (!blocked) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: REASON,
      },
    }),
  );
});
