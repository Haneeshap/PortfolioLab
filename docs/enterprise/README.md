# PortfolioLab — Enterprise Readiness Audit

This directory holds the findings and prioritized backlog from an
enterprise-readiness assessment of the PortfolioLab repository.

The assessment was performed against the **actual repository state** on
disk, not against the feature summary. Every finding records the evidence
(file path + line-level location), the current implementation, the defect
or missing control, the recommended change, acceptance criteria, and an
effort estimate. Prioritization is by **risk and business impact**, not by
novelty.

## How to use these documents

The most important defects are:

1. **No authentication or authorization** on any API or admin path.
2. **Credentials committed in code** — tracked files ship a hardcoded
   default password: `application.properties` line 5
   (`spring.datasource.password=${DB_PASSWORD:local_dev_password}`) and
   `backend-python/app/core/config.py` line 15
   (`DB_PASSWORD: str = "local_dev_password"`). A plaintext `.env` with a
   real password (`PortfolioLabLocalDev2026`) is present on disk but is
   gitignored and not committed — a local-exposure risk if backed up or if
   `.gitignore` lapses.
3. **No security controls at all** — no CORS policy, no CSRF protection,
   no rate limiting, no request size limits on the Spring or FastAPI
   layers, no security headers on responses.
4. **Notification pipeline uses a polled outbox** rather than a
   transactional outbox, introducing a split-brain boundary between the
   order journal and the Kafka message.
5. **Notifications consumer uses lossless duplicate suppression** (a
   `notification_receipts` table with `ON CONFLICT DO NOTHING`) rather
   than Kafka consumer groups / offsets / processing IDs, which is
   fragile at scale and purpose-built.
6. **No database migrations beyond Flyway V1-V24 owned by the backend
   team**, with no rollback procedures or backup/restore documentation.
7. **Health endpoint is a stub** with no dependency probes, no liveness
   /readiness distinction, no metrics, and no tracing.
8. **No CI/CD workflows, coverage thresholds, or container images** in
   the repository.
9. **Search pipeline is split between a FastAPI service and a Java
   backend**, both of which embed into Ollama; the FastAPI `BACKEND_URL`
   and the Java `application.properties` both hardcode loopback ports,
   and the out-of-process search is an unused gate.
10. **AI agent tool permissions are under-defined**: MCP servers are
    session-backed and localhost-only, but the repository has no role
    model, tool allowlisting at the platform level, or prompt-injection
    guidance.

## Audited areas vs. findings

- **A. Service map** — done in `architecture-inventory.md`.
- **B. Order lifecycle** — traced in `reliability-assessment.md`.
- **C. Semantic search** — traced in `reliability-assessment.md` and
  `ai-quality-assessment.md`.
- **D. Security** — assessed in `security-assessment.md`.
- **E. Transactions / idempotency / outbox / Kafka** — assessed in
  `reliability-assessment.md`.
- **F. Observability** — assessed in `observability-assessment.md`.
- **G. Tests / delivery** — assessed in `delivery-assessment.md`.
- **H. AI / MCP / agents** — assessed in `ai-quality-assessment.md`.
- **I. Reuse** — summarized in `prioritized-backlog.md` as "reuse
  instead of rebuild."

## Next step

Read `prioritized-backlog.md` first for the ranked, actionable
backlog. Then read the specific finding document for each area you own.

| Document | Purpose |
| --- | --- |
| [architecture-inventory.md](architecture-inventory.md) | Service map, entry points, ports, dependencies, database owners |
| [security-assessment.md](security-assessment.md) | Auth, authorization, CORS, CSRF, rate limiting, validation, secrets, Developer Studio |
| [reliability-assessment.md](reliability-assessment.md) | Order lifecycle, transactions, idempotency, outbox, Kafka retries, consumer dedup, migrations |
| [observability-assessment.md](observability-assessment.md) | Health checks, logs, metrics, tracing, alerts |
| [delivery-assessment.md](delivery-assessment.md) | Tests, coverage, CI/CD, containers, deployment, backup/restore, rollback |
| [ai-quality-assessment.md](ai-quality-assessment.md) | MCP permissions, prompt-injection exposure, agent command boundaries |
| [prioritized-backlog.md](prioritized-backlog.md) | Ranked, dependency-ordered backlog with effort and acceptance criteria |

## Scope and boundary

- **In scope:** the checked-out repository at the root of this project.
- **Out of scope:** external `portfoliolab-ai/` sibling repository, which
  is referenced but not inside this repository. Findings about AI tools
  are limited to what the repository exposes or invokes.
- **Preserved:** this audit is read-only. It does not overwrite, delete,
  or revert existing user changes, and it does not run destructive
  commands or production migrations.
- **Simulated-only trading boundary is preserved.** No change in these
  documents converts the system into a real brokerage or introduces real
  exchange feeds. All fixes keep the simulated-only boundary.

## Environment notes

The repository contains multiple services plus documentation and audit
artifacts. Key files relevant to this audit:

- `compose.yaml` — PostgreSQL 17 + Kafka containers and loopback ports.
- `backend/pom.xml` — Spring Boot 4.1.1, Java 21, Maven wrapper.
- `backend/src/main/resources/application.properties` — datasource, JPA, Kafka.
- `backend-python/` — FastAPI / SQLAlchemy async / asyncpg / Alembic / pgvector / Ollama.
- `frontend/` — Next.js 16, React 19, TypeScript 5.
- `services/developer-agent/` — Node agent with MCP session bootstrap.
- `services/market-simulator/` — Go price simulator.
- `docs/` — M34-M53 architecture/contract/milestone docs plus quickstart and release verification.

## Current state summary

The repository is a functioning local educational trading platform, not a
mature enterprise platform. It correctly implements simulated order
lifecycles, execution receipts, portfolio analytics, notifications,
risk analysis, watchlists, AI agents, semantic asset search, and SSE
updates. However, it is missing many controls expected of an
enterprise-grade codebase: no authentication or authorization, no
security headers / CSRF / rate limiting, no structured logging or metrics
or tracing, no CI/CD workflows in the repository, no coverage
configuration, no backup/restore documentation, no deployment pipeline,
no health probe beyond a stub endpoint, and no secrets management.
