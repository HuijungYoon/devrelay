#!/usr/bin/env node
/**
 * One Redmine MCP tool call from the terminal.
 *
 * Use this when the plugin's MCP server is not attached to the session: it
 * drives the real server, so the dry-run -> previewToken -> confirm gate still
 * applies. Never hand-roll REST or call the client's write methods instead
 * (AGENTS.md section 4-1) — those have no gate.
 *
 *   node scripts/redmine-call.mjs redmine_search_issues '{"assignedTo":"me"}'
 *   node scripts/redmine-call.mjs redmine_add_comment '{"issueId":1,"notes":"hi"}'
 *   node scripts/redmine-call.mjs --local redmine_test_connection
 *
 * Writes still take two calls: show the dry-run to the user, get their answer,
 * then repeat with confirm:true plus the previewToken it returned.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const useLocal = argv.includes('--local');
const [tool, rawArgs = '{}'] = argv.filter((a) => a !== '--local');

if (!tool) {
  console.error('usage: node scripts/redmine-call.mjs [--local] <tool> [jsonArgs]');
  process.exit(2);
}

let toolArgs;
try {
  toolArgs = JSON.parse(rawArgs);
} catch (err) {
  console.error(`arguments must be JSON: ${err.message}`);
  process.exit(2);
}

// REDMINE_URL / REDMINE_API_KEY from the environment, else the repo .env.
try {
  for (const line of readFileSync(join(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // Fine — the variables may already be exported.
}

const { version } = JSON.parse(
  readFileSync(join(repoRoot, 'packages/redmine-mcp/package.json'), 'utf8'),
);

// The child must run on this Node, not whatever comes first on PATH (v14 here).
const env = { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` };
const child = useLocal
  ? spawn(process.execPath, [join(repoRoot, 'packages/redmine-mcp/dist/index.js')], { env, stdio: ['pipe', 'pipe', 'inherit'] })
  : spawn('npx', ['-y', `redmine-devrelay@${version}`], { env, shell: true, stdio: ['pipe', 'pipe', 'inherit'] });

const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
const timer = setTimeout(() => {
  console.error('timed out after 120s');
  child.kill();
  process.exit(1);
}, 120_000);

let buffered = '';
child.stdout.on('data', (chunk) => {
  buffered += chunk;
  const lines = buffered.split('\n');
  buffered = lines.pop() ?? '';
  for (const line of lines) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.id !== 2) continue;
    clearTimeout(timer);
    const text = message.result?.content?.[0]?.text ?? JSON.stringify(message.error ?? message, null, 2);
    console.log(text);
    child.kill();
    process.exit(message.result?.isError || message.error ? 1 : 0);
  }
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'redmine-call', version },
  },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
setTimeout(
  () => send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: toolArgs } }),
  useLocal ? 300 : 2500,
);
