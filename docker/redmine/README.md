# Local Redmine for integration tests

Docker Compose 또는 **Podman**으로 동일하게 띄울 수 있습니다.

## Start (Podman 권장 — 이 환경)

```bash
cd docker/redmine
podman compose up -d
```

## Start (Docker)

```bash
docker compose -f docker/redmine/docker-compose.yml up -d
```

Wait until http://localhost:3000 responds (first boot can take a few minutes).

## Seed (API + sample issues)

컨테이너가 뜬 뒤:

```bash
podman cp docker/redmine/seed.rb redmine-redmine-1:/tmp/seed.rb
podman exec redmine-redmine-1 bash -lc "bundle exec rails runner /tmp/seed.rb"
```

스크립트가 REST API를 켜고 admin API Key·`Cloud HMI` 프로젝트·샘플 이슈 3개를 만듭니다.  
출력의 `API_KEY=...` 값을 환경변수에 넣으세요.

(수동 UI 시드도 가능: admin 로그인 → REST API 활성화 → 프로젝트/이슈 생성)

## Test env

```bash
export REDMINE_URL=http://localhost:3000
export REDMINE_API_KEY=<your-key>
export REDMINE_ALLOWED_HOSTS=localhost
export REDMINE_INTEGRATION=1
pnpm --filter redmine-devrelay-client exec vitest run tests/integration
```

Without `REDMINE_INTEGRATION=1`, integration tests are skipped.

## Stop

```bash
cd docker/redmine
podman compose down
```
