/**
 * Truth table for the plugin's Redmine write guard
 * (plugins/claude-code/hooks/block-redmine-rest-writes.mjs).
 *
 *   node scripts/tests/guard.test.mjs
 *
 * The two ALLOW rows about echo/grep are the regressions that matter: an early
 * version matched the command text anywhere, so merely printing or grepping a
 * Redmine write got blocked. The python -c row is the other one: quotes hide
 * the shell separators, so that command has to be judged as a whole.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const guard = join(repoRoot, 'plugins/claude-code/hooks/block-redmine-rest-writes.mjs');

const decide = (payload) => {
  const result = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`guard exited ${result.status}: ${result.stderr}`);
  return result.stdout.includes('"deny"') ? 'BLOCK' : 'ALLOW';
};

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });
const write = (content) => ({ tool_name: 'Write', tool_input: { file_path: 'x', content } });

const cases = [
  ['BLOCK', 'curl POST to an issue', bash("curl -X POST http://192.168.1.20/redmine/issues/24067.json -d @b.json")],
  ['BLOCK', 'python -c with requests.put', bash("python -c \"import requests; requests.put('http://192.168.1.20/redmine/issues/1.json', json=p)\"")],
  ['BLOCK', 'writing a python script that PUTs', write("import requests\nrequests.put('http://192.168.1.20/redmine/issues/24067.json', json={'issue':{'notes':'x'}})")],
  ['BLOCK', 'writing a node script using the client', write("await client.addComment(24067, 'hi') // /issues/24067.json")],
  ['ALLOW', 'GET read', bash('curl -s http://192.168.1.20/redmine/issues/24067.json')],
  ['ALLOW', 'echo printing a write command', bash('echo \'{"cmd":"curl -X POST http://192.168.1.20/redmine/issues/1.json"}\' | node check.mjs')],
  ['ALLOW', 'the gated helper', bash('node scripts/redmine-call.mjs redmine_add_comment \'{"issueId":1,"notes":"x"}\'')],
  ['ALLOW', 'grepping for write calls', bash("grep -rn 'requests.post' . | grep redmine/issues")],
  ['ALLOW', 'unrelated file', write('export const x = 1;')],
  ['ALLOW', 'docs mentioning a read', write('GET /issues/1.json 으로 조회합니다.')],
  ['ALLOW', 'app code with its own addComment', write('export function addComment(text: string) { return text; }')],
];

let failed = 0;
for (const [expected, label, payload] of cases) {
  const actual = decide(payload);
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${actual.padEnd(5)} (want ${expected.padEnd(5)}) ${label}`);
}

console.log(failed === 0 ? `\n${cases.length} passed` : `\n${failed} failed`);
process.exit(failed ? 1 : 0);
