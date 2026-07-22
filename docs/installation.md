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

현재 배포 버전: **`0.5.0`**

```bash
npm install -g redmine-devrelay@0.5.0
```

Or rely on `npx -y redmine-devrelay@0.5.0` from plugin `.mcp.json` / `mcp.json`.

Client 패키지(라이브러리): `redmine-devrelay-client@0.5.0`.

## 5. Claude Code

**Breaking:** slash namespace is `/redmine-devrelay:…` (was `/redmine:…`).

Set `REDMINE_URL` / `REDMINE_API_KEY` first (section 3).

Marketplace install:

```text
/plugin marketplace add HuijungYoon/devrelay
/plugin install redmine-devrelay@devrelay
/reload-plugins
```

Local clone / path marketplace:

```text
/plugin marketplace add /path/to/devrelay
/plugin install redmine-devrelay@devrelay
```

Dev fallback (no marketplace):

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash 예: `/redmine-devrelay:help`, `/redmine-devrelay:my-issues`, `/redmine-devrelay:create-issue`.  
쓰기는 **미리보기 → 확인 → 적용**.

Community submit prep: `docs/claude-code-marketplace-submit.md`.

## 6. Codex

Load `plugins/codex` per Codex plugin docs.  
Skills: `help`, `my-issues`, `issue`, `create-issue`, `update-issue`, `add-comment`, `update-status` 등.

## 7. Cursor

After Marketplace listing: `/add-plugin redmine-devrelay`.  
로컬: `plugins/cursor/mcp.json`이 `redmine-devrelay@0.5.0`를 가리킴.  
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
npx @modelcontextprotocol/inspector npx -y redmine-devrelay@0.5.0
```
