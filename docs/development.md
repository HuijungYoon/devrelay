# Development

```bash
pnpm install
pnpm --filter @m2i/redmine-client test
pnpm --filter @m2i/redmine-mcp test
pnpm --filter @m2i/redmine-client build
pnpm --filter @m2i/redmine-mcp build
```

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

## Docker integration tests

See `docker/redmine/README.md`. Then:

```bash
export REDMINE_INTEGRATION=1
pnpm --filter @m2i/redmine-client test
```

## Publish dry-run

```bash
pnpm --filter @m2i/redmine-client exec npm pack --dry-run
pnpm --filter @m2i/redmine-mcp exec npm pack --dry-run
```
