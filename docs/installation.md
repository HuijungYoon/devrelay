# Installation

## 1. Enable Redmine REST API

Administration → Settings → API → enable REST web service.

## 2. Create an API key

My account → API access key.

## 3. Set environment variables

```bash
export REDMINE_URL=https://redmine.example.com
export REDMINE_API_KEY=your-key
export REDMINE_ALLOWED_HOSTS=redmine.example.com
```

For private CA certificates:

```bash
export REDMINE_CA_CERT_PATH=/path/to/company-ca.pem
```

## 4. Install MCP package (internal npm)

```bash
npm install -g @m2i/redmine-mcp@0.1.0 --registry <internal-registry>
```

Or rely on `npx -y @m2i/redmine-mcp@0.1.0` from plugin `.mcp.json`.

## 5. Claude Code

```bash
claude --plugin-dir ./plugins/claude-code
```

Slash commands:

- `/redmine:my-issues`
- `/redmine:issue 1523`

## 6. Codex

Load `plugins/codex` per Codex plugin docs. Skills: `my-issues`, `issue`.

## 7. Connection check

Ask the agent to call `redmine_test_connection`, or use MCP Inspector.
