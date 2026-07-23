# Installation

## 1. Enable Redmine REST API

Administration → Settings → API → enable REST web service.

## 2. Create an API key

My account → API access key.

## 3. Set environment variables

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your-key
```

Optional:

```bash
export REDMINE_ALLOWED_HOSTS=redmine.example.com
export REDMINE_CA_CERT_PATH=/path/to/company-ca.pem
```

사설망 HTTP 예: `REDMINE_URL=http://192.168.10.50/redmine` (RFC1918 IP는 allowlist 없이 HTTP 허용).

## 4. Install MCP package (npm)

현재 배포 버전: **`0.5.1`**

```bash
npm install -g redmine-devrelay@0.5.1
```

Or rely on `npx -y redmine-devrelay@0.5.1` from plugin `.mcp.json` / `mcp.json`.

Client 패키지(라이브러리): `redmine-devrelay-client@0.5.1`.

## 5. Claude Code

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash 예: `/redmine:help`, `/redmine:my-issues`, `/redmine:create-issue`, `/redmine:update-issue`.  
쓰기는 **미리보기 → 확인 → 적용**.

## 6. Codex

Requires Codex CLI with `codex plugin marketplace` / `codex plugin add` (upgrade from older builds such as 0.107.0 if missing).

Git marketplace:

```bash
codex plugin marketplace add HuijungYoon/devrelay
codex plugin add redmine-devrelay@devrelay
```

Local (repo root):

```bash
codex plugin marketplace add .
codex plugin add redmine-devrelay@devrelay
```

Set `REDMINE_URL` / `REDMINE_API_KEY`. Skills: `help`, `test-connection`, `list-projects`, `my-issues`, `issue`, `create-issue`, `update-issue`, `add-comment`, `add-attachment`, `update-status`.  
Details: `plugins/codex/README.md`.

## 7. Cursor

After Marketplace listing: `/add-plugin redmine-devrelay`.  
로컬: `plugins/cursor/mcp.json`이 `redmine-devrelay@0.5.1`를 가리킴.  
See `plugins/cursor/README.md`.

## 8. Antigravity

```bash
agy plugin install ./plugins/antigravity
agy plugin list
```

From GitHub:

```bash
git clone https://github.com/HuijungYoon/devrelay.git
agy plugin install ./devrelay/plugins/antigravity
```

Set `REDMINE_URL` / `REDMINE_API_KEY`. If `${REDMINE_URL}` / `${REDMINE_API_KEY}` in plugin `mcp_config.json` is not expanded, configure `~/.gemini/config/mcp_config.json` (see `plugins/antigravity/README.md`).

Slash 예: `/redmine:help`, `/redmine:my-issues`, `/redmine:create-issue`.  
쓰기는 **미리보기 → 확인 → 적용**.

## 9. Connection check

Ask the agent to call `redmine_test_connection`, or use MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx -y redmine-devrelay@0.5.1
```
