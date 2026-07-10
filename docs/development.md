# Development

```bash
pnpm install
pnpm --filter redmine-client test
pnpm --filter redmine-mcp test
pnpm --filter redmine-client build
pnpm --filter redmine-mcp build
```

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

## Docker integration tests

See `docker/redmine/README.md`. Then:

```bash
export REDMINE_INTEGRATION=1
pnpm --filter redmine-client test
```

## Publish dry-run

```bash
pnpm --filter redmine-client exec npm pack --dry-run
pnpm --filter redmine-mcp exec npm pack --dry-run
```
