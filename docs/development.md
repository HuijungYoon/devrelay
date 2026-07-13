# Development

```bash
pnpm install
pnpm --filter redmine-devrelay-client test
pnpm --filter redmine-devrelay test
pnpm --filter redmine-devrelay-client build
pnpm --filter redmine-devrelay build
```

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector node packages/redmine-mcp/dist/index.js
```

## Docker integration tests

See `docker/redmine/README.md`. Then:

```bash
export REDMINE_INTEGRATION=1
pnpm --filter redmine-devrelay-client exec vitest run tests/integration
```

## Publish dry-run

```bash
pnpm --filter redmine-devrelay-client exec npm pack --dry-run
pnpm --filter redmine-devrelay exec npm pack --dry-run
```
