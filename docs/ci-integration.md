# CI / CD Integration

Run the Qaera pipeline (generate → execute → heal → visual → report)
automatically from your CI on every pull request, and block the PR if it fails.

## 1. Generate a project API token

1. Open your project → **CI / CD**.
2. Under **CI tokens**, enter a name (e.g. `GitHub Actions CI`) and an optional
   expiry, then **Generate token**.
3. The raw token (`qaera_…`) is shown **once**. Copy it immediately — it is never
   shown again. Only a sha256 hash and an 8-char prefix are stored.

Tokens are **scoped to a single project**. The trigger/results endpoints derive
the project from the token, so a token can only act on its own project.

Admin or owner role is required to create or revoke tokens.

## 2. GitHub Actions (composite action)

Add the token as a repository secret named `QAERA_TOKEN`
(Settings → Secrets and variables → Actions).

This repo ships a composite action at `.github/actions/qaera-run`. Use it:

```yaml
name: Qaera on PR
on: pull_request
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/qaera-run
        with:
          api-token: ${{ secrets.QAERA_TOKEN }}
          api-base-url: https://app.qaera.ai
          target-url: https://staging.example.com
          visual: "true"
          fail-on-regression: "true"
          timeout-seconds: "600"
```

Once published to the Marketplace, you can instead reference
`uses: your-org/qaera-action@v1`.

### Action inputs

| Input                | Required | Default                      | Description                              |
| -------------------- | -------- | ---------------------------- | ---------------------------------------- |
| `api-token`          | yes      | —                            | Project API token (use a secret).        |
| `target-url`         | yes      | —                            | URL under test.                          |
| `api-base-url`       | no       | `https://app.qaera.ai`  | Qaera base URL.               |
| `visual`             | no       | `true`                       | Run visual regression.                   |
| `fail-on-regression` | no       | `true`                       | Fail the job when the pipeline fails.    |
| `timeout-seconds`    | no       | `600`                        | Max time to wait for completion.         |

The action triggers a pipeline, polls every 5s until terminal, writes a summary
(status, stages, link) to `$GITHUB_STEP_SUMMARY`, and exits non-zero on failure
when `fail-on-regression` is `true`. CI metadata (`ref`, `commit`, `prNumber`)
is captured automatically from the GitHub event for traceability.

## 3. GitLab CI

```yaml
qaera:
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      RUN=$(curl -sS -X POST "$QAERA_BASE_URL/api/ci/trigger" \
        -H "Authorization: Bearer $QAERA_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"targetUrl\":\"https://staging.example.com\",\"visual\":true,\"ref\":\"$CI_COMMIT_REF_NAME\",\"commit\":\"$CI_COMMIT_SHA\"}")
      ID=$(echo "$RUN" | jq -r '.pipelineRunId')
      while true; do
        RESP=$(curl -sS "$QAERA_BASE_URL/api/ci/runs/$ID" -H "Authorization: Bearer $QAERA_TOKEN")
        STATUS=$(echo "$RESP" | jq -r '.status')
        case "$STATUS" in succeeded|failed|error) break;; esac
        sleep 5
      done
      [ "$(echo "$RESP" | jq -r '.conclusion')" = "success" ]
```

## 4. Generic curl (any CI)

```bash
curl -X POST "$QAERA_BASE_URL/api/ci/trigger" \
  -H "Authorization: Bearer $QAERA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl":"https://staging.example.com","visual":true}'
```

## 5. API contract

All CI endpoints authenticate via `Authorization: Bearer <token>`.

### POST `/api/ci/trigger`

Request body (JSON):

| Field       | Type    | Required | Notes                                    |
| ----------- | ------- | -------- | ---------------------------------------- |
| `targetUrl` | string  | yes      | Must be a valid URL.                     |
| `autoHeal`  | boolean | no       | Default `true`.                          |
| `autoBug`   | boolean | no       | Default `true`.                          |
| `notify`    | boolean | no       | Default `true`.                          |
| `visual`    | boolean | no       | Run visual regression.                   |
| `ref`       | string  | no       | CI metadata (branch/tag ref).            |
| `commit`    | string  | no       | CI metadata (commit SHA).                |
| `prNumber`  | number  | no       | CI metadata (pull request number).       |

Responses:

- `202 Accepted` — `{ "pipelineRunId": "...", "statusUrl": "/api/ci/runs/<id>" }`
- `400` — invalid body
- `401` — missing/invalid/expired token
- `429` — rate limited (max 30 requests/min per token; `Retry-After` header)

### GET `/api/ci/runs/<id>`

Returns the run, scoped to the token's project (other projects return `404`):

```json
{
  "id": "...",
  "status": "queued | running | succeeded | failed | error",
  "conclusion": "success | failure | neutral",
  "gate": {
    "verdict": "pass | pass_with_warnings | fail | pending",
    "reasons": ["Failure classified as flaky and this test is quarantined — not blocking the merge"],
    "failureClass": "real_bug | flaky | environment | automation | null",
    "quarantineApplied": false
  },
  "summary": "…",
  "stages": [{ "name": "execute", "status": "succeeded" }],
  "finalRunId": "…",
  "bugReportId": null,
  "url": "https://app.qaera.ai/projects/<id>/pipeline"
}
```

Conclusion mapping: `succeeded → success`, `failed`/`error` → `failure`,
everything else → `neutral`. Poll until `status` is terminal
(`succeeded`/`failed`/`error`).

### The flakiness-aware merge gate

Prefer `gate.verdict` over the raw `conclusion` when deciding whether to fail
the CI job. The gate consults the AI failure classification of the final run:

| Situation | `gate.verdict` | Blocks merge? |
| --- | --- | --- |
| All stages succeeded | `pass` | No |
| Failure classified `flaky` **and** the test is quarantined | `pass_with_warnings` | **No** — known-flaky tests don't block your team |
| Failure classified `flaky`, not quarantined | `fail` | Yes — run flakiness detection, quarantine if confirmed |
| Failure classified `real_bug` | `fail` | Yes — the test caught a product defect |
| Failure classified `environment` | `fail` | Yes — retry recommended |
| Failure classified `automation` | `fail` | Yes — fix or self-heal the script |

The bundled GitHub Action already honors `gate.verdict` (falling back to
`conclusion` against older servers) and prints the verdict, failure class, and
reasons in the job summary.

## 6. Security notes

- **Project scoping** — tokens act only on their own project; the project is
  derived from the token, never from a URL parameter.
- **Storage** — only a sha256 hash and an 8-char prefix are persisted. The raw
  token is shown once at creation.
- **Rotation** — generate a new token, update the `QAERA_TOKEN` secret, then
  revoke the old one.
- **Revocation** — revoking sets `revokedAt`; the token is rejected immediately.
- **Expiry** — set an optional expiry at creation; expired tokens are rejected.
- **Rate limiting** — 30 trigger requests per minute per token.
- **Auditing** — `citoken.create`, `citoken.revoke`, and `ci.trigger` are
  recorded in the audit log.
```
