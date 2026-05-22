---
slug: go
title: Go
summary: AI-powered French public procurement response platform. Turns tender documents into complete, auditable candidature packages.
type: app
section: apps
createdAt: 2026-01-01
---

<video controls preload="metadata" width="100%" style="border-radius: 4px; margin-bottom: 1rem;">
  <source src="/videos/go-demo-web.mp4" type="video/mp4" />
</video>

LLM-driven public market candidature app producing 20-50 page candidature packages for enterprises targeting tender offers.

Consultants:

- ingest Dossier de Consultation des Entreprises (DCE) (1 LLM + OCR)
- enterprise client data dump (description, financials, references, CVs, etc.) (1-2 LLM + OCR)
- Market + Client -> assessment and fill plan (1 LLM) -> assembly (3-5 LLM) -> human review, edit, and export

Typical run: 8–12 sequential LLM calls, ~$0.75 on Haiku 4.5

---

## Decisions

### Inference only where inference is required
The cheap path runs first. Inference is a fallback, not a default.

- **~80% of document classification**: regex on filenames (French procurement has stable naming conventions — `RC`, `CCAP`, `BPU`, `DC1`, `DC2`...).
- **Form extraction**: deterministic XML/SDT parsing on `.docx`; structured slot+coordinate capture on `.pptx`.
- **Requirement → document matching**: registry lookup against 45 typed field families (financial, contact, certifications, references...), not semantic search.
- **Artifact resolution**: document-type matching + FK lookups.

Net: ~10 LLM calls per complete proposal. Predictable, bounded cost.

### Market extraction
This is one big call (token-count batching patch exists). DCE docs cross-reference frequently, multi-pass required repeating context across calls or passing state. Single call does:
- document classification
- identification of the primary (`RC`)
- eligibility requirements
- required-document list
- market metadata (deadline, procedure type)


### Client profile: 3 passes, additive
Passes have explicit token budgets and file-type include/exclude:
1. **Facts** — deterministic structured data
2. **Structured info** — known document types (insurance attestations, KBIS, certifications)
3. **Synthesis** — areas of expertise, company presentation

Output is Pydantic-typed with per-field provenance and confidence. Updating one family re-runs only the relevant pass; LLM resolves conflicts. Notable fields surface to reviewer; manual override persists across re-runs (client profiles are durable — markets change, the client doesn't).

### Plan/assemble: planner picks, assembler dispatches
The planner outputs three parts: fit analysis (inference), eligibility check (criterion match), and a per-document fill plan with one of four approaches:

- **Pass-through** — certifications, insurance attestations, KBIS
- **Form-fill** — standard forms with SDT content controls; templates from the DCE with captured slot coordinates and field IDs
- **Narrative** — planner provides outline + evidence pulled from KV families
- **Skip with justification**

Why an inference planner: there's no standardization in how requirements are framed. "Note méthodologique sur X" might be best served by pass-through, narrative, or a DCE-provided template. The trigger is a joint function of (what was asked, shape provided, client documents available) — so this is pattern matching, not lookup.

Failures surface explicitly in two gap tables:
- **Eligibility gaps** — requirements the client doesn't meet
- **Information gaps** — planner couldn't find the answer

Reviewers can override the planner's approach in the 3-panel UI.

### Assembly is a pure dispatcher
PPTX templates take two calls — one for slot fills, one for reference zones — using captured cell coordinates and field IDs. LLM-driven fills retry until the schema is satisfied. No agentic loops, no multi-turn conversations — each call has a fixed stage name, versioned prompt, schema forced via `tool_use`, and full input/output logging.
PPTX custom forms do not work very well yet.

### Edits are additive, not destructive
Original content and edits are stored separately, keyed by author and timestamp. Re-running the pipeline updates the original; the edit layer stays. This is the substrate for a learning loop: original vs. final-edited diffs are training signal.

### Preview rendering is a deliberate tradeoff
PDF re-render on form-field edits goes through headless LibreOffice — a couple seconds. We've kept it server-side because the product is *value review*, not document editing. In-browser rendering is on the table but deferred.

---

## Infrastructure decisions

### Content-addressed extraction cache
Keyed by SHA-256 of file content. Same document across users, tenants, names → cache hit, zero reprocessing. Cache key includes extraction-logic version so a parser change invalidates cleanly.

### Sandboxed document conversion
Headless LibreOffice runs inside `bwrap`:
- `--clearenv` — only `HOME=/tmp`, `PATH`, `TMPDIR`; no credential leakage
- `--unshare-net` — no network from inside the sandbox
- Narrow `/etc` mounts — fonts + locale only; no `/etc/shadow`, no SSH keys

The Dec 2024 / Jan 2025 LibreOffice CVEs were patched before exploitation.

### Multi-format extraction, one schema
PDF (pymupdf + pdfplumber), DOCX (lxml traversal for nested content), PPTX (per-slide), XLSX. Quality heuristics (char-count-per-page, line length, image-block ratio) route incomplete pages to Azure Document Intelligence OCR. All handlers emit the same `ExtractionResult`.

### Postgres as the job queue
`SELECT … FOR UPDATE SKIP LOCKED`. Jobs survive restarts, retry on failure, produce complete audit trails. No Redis, no SQS, no Celery — just Postgres at this scale.

### Multi-tenancy at the database
Row-level security on every tenant-scoped table, enforced via `SET app.current_tenant`. The app role sees nothing without it. Superuser is required to see across tenants — application code cannot accidentally widen scope.

### Full provenance + deterministic replay
- **Execution logs**: every LLM call stored with prompt text, raw response, validated output, token counts, cost
- **Step results**: one auditable record per pipeline stage per entity
- **Field provenance**: form fields trace through family → source file → page
- **Replay**: any logged call can be re-submitted to a different model without re-extraction — useful for prompt regressions and model comparisons

### Prompt-level caching
Identical prompts return cached results at $0.00. Safe across schema versions via re-validation on read.

---

## Architecture at a glance

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14 (App Router), TypeScript, shadcn/ui |
| Backend | FastAPI, async Python, `tool_use` for structured LLM output |
| Database | PostgreSQL 16, RLS, asyncpg (no ORM), dbmate migrations |
| Storage | Cloudflare R2 (S3-compatible) |
| LLM | Claude Haiku 4.5 default, Sonnet toggle |
| Conversion | Headless LibreOffice in bwrap |
| Infra | Hetzner VPS, Neon serverless Postgres, Cloudflare Access |

---

## What's not built yet
- Formal eval loop. The edit-layer data is the substrate; the harness isn't wired in.
- In-browser preview rendering. Deliberately deferred — see preview tradeoff above.