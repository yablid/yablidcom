---
slug: lepricer
title: Chiffreur
summary: AI-Driven Pricing Workbench for building engineers
type: app
section: apps
createdAt: 2026-01-05
---

<video controls preload="metadata" width="100%" style="border-radius: 4px; margin-bottom: 1rem;">
  <source src="/videos/lepricer-demo-web.mp4" type="video/mp4" />
</video>

Webapp and companion Claude Desktop workbench to help engineers price large French construction projects.
The goal is to provide engineers with the right context to leverage their expertise, not generate prices.

```
Ingest tender package (DCE including DGPF, CCTP and other technical context - ~1GB)
                ↓
Classify (regex first, LLM fallback)
                ↓
Extract DPGF (Excel) - structure and taxonomise
                ↓
-Extract Technical Context (CCTP, RICT, +)
    -> Pair with DGPF
    -> Synthesize technical context
    -> Link to line-item, section, project
                ↓
Engineer pricing UI:
| price lookup (db) | Cost lines, geometry | Technical Context |
```
---

### Document classification
Regex-first, LLM sample second on manual trigger

### Technical content extraction
- Python doc libraries (pymupdf + pdfplumber)
- Infer layout via domain conventions (numbered hierarchy) & regex / typography heuristics

### DPGF extraction: Two LLM calls, schema-locked via Pydantic + `tool_use`:
- Which sheets are relevant (not cover / recap / etc. but contain items to price)
- Which row is header (line-items have units, section/subsections have structural prefixes)
- Fail loudly - base layer for downstream pricing work.

### Taxonomy: proprietary (based on standards), two-pass coarse→fine
~1300 nodes across 5 levels, sourced from UNTEC, adjacent public references, inference.

- **Coarse pass** → L3 (~300 nodes), batched 150 line items per call.
- **Fine pass** → L3–L5 within the matched L3 subtree.
- **Fallback** — items with no deeper match attach to the parent. Precision lost, not
  correctness.

The two-pass / batch size came from ten sample projects scored both statistically (depth
distribution) and manually (was the item classified correctly).

Failure mode is *systemic* inaccuracy, not point errors. Engineers quickly recognize if they are pricing masonry and see an hvac system price (and can flag).

### Context pairing: LLM call to pair -> N to synthesize (1 per section)

Per-section synthesis driven by compound unique key in DB — one packet
per (DPGF node, source document). That key gives us:
- many CCTP items attaching to one DPGF node
- many DPGF nodes sharing CCTP context (two synthesis calls)
- multiple source documents (CCTP, RICT, …) each contributing their own packet to the
  same DPGF node

- **Call 1 — pair**: ~5k tokens total. Returns CCTP sections × DPGF sections matches.
- **Call N — synthesize**: one call per DPGF section (typically 30+). Takes paired CCTP
  sections and produces a single context packet for that DPGF node from that source
  document.

Failure modes are honest:
- Engineers see empty context if pairing finds nothing; flagged for review. A companion
  coding agent classifies these as system failures vs. genuinely no-context items.
- Orphan packets are possible if the LLM hallucinates a target ID — we monitor.
- 40k-char truncation on call tails.
- OCR pipe exists for context tables (heuristic detection + manual rerun)

### Search surfaces context, not answers
Three layers, deduped and presented in order:

1. **Full-text search** — deterministic normalization first: expand abbreviations,
   convert known synonyms (TOML files), extract numerics into typed fields
   (`epaisseur_mm: 140`), normalize units (`sqm` → `m²`), strip numbers from the search
   text. Then Postgres `tsvector`: dropped articles, stemmed, positional scoring.
2. **Trigram** — character overlap. Catches product codes, partial matches, near-misses
   FTS drops.
3. **Taxonomy browse** — does the matched node hold any prior-quoted articles?

Line items are forcibly unique for the most part. A plaster cieling has type, thickness, application method, fixture method, etc. The goal isn't to surface the price - but to surface the field of prices for engineer to apply expertise.

### Pricing model: cost lines + formulas
Each DPGF line item owns N cost lines. Each cost line has a type and a formula.
Quantities are manual or geometric.

Example — ceiling masonry per m²:
- plaster (geometric: thickness × area)
- fixtures (per-m² rate)
- labor (per-m² + setup)

Lines roll up automatically to a unit price for the DPGF item. Direct vs. indirect costs
are first-class — indirect lines apply over total project quantity, not per item. Price
rows are append-only; every modification leaves a trace.

---

## Eval posture: signal, not statistics

Eval is largely built into the workflow. These are large projects, few in number, high variance in line items.

- **Classify** — engineers drag-drop in the UI; we log moves and "other" assignments.
- **DPGF** — Pydantic shape + semantic invariant checks. Engineer sees the parsed
  structure in the UI on entry; broken hierarchies are immediately visible and
  re-runnable before they surface to us.
- **Taxonomy** — depth distribution and parent-fallback rate as health indicators.
- **Search** — coverage by source (FTS, trigram, taxonomy). Empty/sparse result sets are
  leading indicators. Engineers can file "poor search" inline from the result UI.
- **Pricing** — time-on-item plus the append-only price history surface where engineers
  fight the system.

The thesis: in a low-volume, high-variance domain, statistical eval lies. We instrument
the engineer's friction and treat that as the loop.

---

## Infrastructure

### Project-scoped multi-tenancy in Postgres
One Neon cluster. Every row carries `project_id uuid`. Single-tenant today;
multi-tenancy enforced in application code at the repository boundary. No ORM — asyncpg,
raw SQL, `$1` params.

### Postgres as everything
Source of truth for projects, documents, extraction results, taxonomy, context packets,
cost lines, edits. Migrations applied via a single `migrate` entry point. Read tooling
is `uv run python -m core.db.query <project> "<sql>"` — read-only transaction by
default, no inline SQL in scripts.

### R2 for raw bytes only
Cloudflare R2 (S3-compatible). Documents keyed by
`projects/<project_uuid_hex>/<file_hash>`. Local cache at `projects/<name>/cache/` is
hash-addressed and re-fillable on demand. Git tracks code only — never project data,
never DB dumps.

### Security model
- **Edge** — Cloudflare Tunnel terminates at the VPS. No inbound HTTP. The hostname
  resolves through CF Tunnel with CF Access in front.
- **Auth** — humans via CF Access (email OTP + verified JWT); programmatic via service
  tokens. Legacy bearer-token path being retired.
- **Authorization** — credential scope (read / write / admin) × per-project access
  (viewer / editor / admin).
- **SSH** — Tailscale mesh only; no public SSH listener.

### Two runtimes, one core
The same codebase serves the web app and an engineer *workbench* — a Claude Code session
running against the same `core/` (steps, prompts, contracts, DB). The webapp does
one-shot LLM calls; the workbench reasons iteratively with the engineer. Same DB, same
R2, same step registry.

The workbench has a secondary purpose: observation. It sees what the automated path gets
wrong and feeds back via R2-shipped session digests, observations, and structured
reports. The edit-and-correction stream is the substrate for a future eval loop.

---

## Architecture at a glance

| Layer | Stack |
|---|---|
| Frontend | SvelteKit + TypeScript |
| Backend | FastAPI, async Python (uv), `tool_use` for structured LLM |
| Database | Neon Postgres, asyncpg, raw SQL (no ORM) |
| Storage | Cloudflare R2 |
| LLM | Claude Haiku 4.5 default, Sonnet runtime toggle |
| Excel | openpyxl |
| PDF | pymupdf + pdfplumber |
| Hosting | Hetzner VPS, systemd, Cloudflare Tunnel + Access, Tailscale for SSH |