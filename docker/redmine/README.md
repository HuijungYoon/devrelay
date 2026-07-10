# Local Redmine for integration tests

## Start

```bash
docker compose -f docker/redmine/docker-compose.yml up -d
```

Wait until http://localhost:3000 responds (first boot can take a few minutes).

## Enable REST API

1. Sign in as admin (default often `admin` / `admin`, then forced password change)
2. Administration → Settings → API → enable REST web service
3. My account → API access key → show / reset

## Seed (manual)

1. Create a project (e.g. `Cloud HMI`)
2. Create several issues assigned to your user
3. Optionally create 100+ issues if you need pagination coverage

## Test env

```bash
export REDMINE_URL=http://localhost:3000
export REDMINE_API_KEY=<your-key>
export REDMINE_ALLOWED_HOSTS=localhost
export REDMINE_INTEGRATION=1
pnpm --filter @m2i/redmine-client test
```

Without `REDMINE_INTEGRATION=1`, integration tests are skipped.
