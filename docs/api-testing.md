# API Testing

Import an API spec, generate test cases with AI, then **execute them as real
HTTP requests** with assertion checking — all from the project's **API Testing**
page.

## Flow

1. **Import spec** — paste an OpenAPI/Swagger document (JSON or YAML) or a
   Postman collection. Endpoints are parsed into `ApiEndpoint` records. The type
   is auto-detected.
2. **Generate test cases** — pick endpoints; AI produces functional / negative /
   edge / security test cases per endpoint, saved as `TestCase` rows (type
   `api`, linked to the endpoint).
3. **Run tests** (the "Run tests" tab) — select API-linked test cases and
   execute them. Each run:
   - **compiles** the natural-language test case into a concrete executable
     request (`method`, `path`, `headers`, `query`, `body`, `assertions`) via
     the `api-test-compiler` AI helper — cached on `TestCase.compiledRequest`
     so re-runs don't call the LLM again;
   - **executes** the HTTP request against the spec's `baseUrl` (30s timeout,
     redirects not followed);
   - **evaluates assertions** and stores the result on an `ApiTestRun` row.

## Assertion kinds

The compiler emits, and the runner evaluates, these checks:

| Kind | Meaning |
| --- | --- |
| `status_equals` | Response status equals `value` |
| `status_in_range` | Status within `[rangeMin, rangeMax]` (e.g. 200–299) |
| `header_exists` | Header `target` is present |
| `header_contains` | Header `target` contains substring `value` |
| `body_contains` | Raw body contains substring `value` |
| `json_path_exists` | Dotted JSON path `target` (e.g. `data.items.0.id`) exists |
| `json_path_equals` | JSON path `target` equals `value` (string compare) |
| `response_time_lt` | Response time under `value` ms |

A run **passes** only when every assertion passes.

## Requirements & limits

- The imported spec **must have a base URL** (OpenAPI `servers[].url`, Swagger
  `host`+`basePath`, or a Postman `baseUrl` variable). Runs error clearly if it
  doesn't.
- Requests execute from the server, so the target API must be reachable from the
  app's network. In a sandbox with no outbound access, runs will fail with a
  network error (this is expected).
- Auth: the compiler inserts placeholder credentials (e.g.
  `Authorization: Bearer <token>`) and deliberately-invalid tokens for security
  test cases. Real credential injection is a future enhancement.
- Test cases run **sequentially** to be gentle on the target API.

## Contract checks (spec-vs-code drift)

From a spec's detail view, **Run contract check** probes the live API and
verifies each endpoint's response against the documented contract:

- **Undocumented status codes** — the API returned a status the spec doesn't
  document (top-3 cause of production incidents in distributed systems).
- **Content-type drift** — spec documents JSON, API returned something else.
- **Schema violations** — missing required properties, wrong types, values
  outside documented enums (validated structurally: `type`, `properties`,
  `required`, `items`, `nullable`, `enum`; `$ref`/`allOf`/`oneOf`/`anyOf`
  subtrees are skipped, never guessed).

Safety: only **GET/HEAD** endpoints are probed by default. Non-GET methods are
skipped (they can mutate real data) unless "include non-GET" is explicitly
enabled. Path parameters are filled from spec examples where available, else
`1`. Results are stored per endpoint on a `ContractRun`/`ContractResult` pair,
with the last 10 runs kept visible.

## Generating code instead of running

The generated `api` test cases are ordinary `TestCase` rows, so the **Automation
Code Generator** also picks them up — produce owned Playwright (TypeScript) or
REST Assured (Java) code for the same cases when you want portable code rather
than in-tool execution.
