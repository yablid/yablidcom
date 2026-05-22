---
slug: dolly
title: Dolly
summary: AI-augmented litigation workbench plus client-intake webapp. Concierge legal AI — lawyer drives, agents follow.
type: app
section: apps
createdAt: 2026-05-22
---

Two-part platform. A client-facing webapp for intake and simple demand-letter generation, and a litigation workbench running on Claude Code. The webapp
is straightforward; the workbench is the interesting half.

**Webapp** — White-label intake sites with our structural template under the firm's branding. Three-agent flow (requirements → facts → generation) with
the lawyer in the loop at each step.

**Workbench** — Per-lawyer Claude Code environment delivered as a git repo, run via Claude Desktop. Skills, subagents, templates, and knowledge cover the
full lifecycle: new-matter scaffolding, multi-session Word drafting, Bluebook citation formatting, caselaw verification, adversarial stress tests,
attorney-defined templates.

The pitch isn't feature parity with Harvey. It's concierge customization — we can't compete on breadth, they can't compete on personalization.

---

## Decisions

### Attorney drives, agent follows
Core principle, enforced at three levels:

- **System prompt** — conversational steps, ask before expanding scope, explicit "you are not the attorney" framing.
- **PostToolUse hook** — forces a check-in every N tool calls. The agent cannot run away.
- **PreToolUse hook + Claude's permission system** — constrains writes to expected directories, blocks force-push to main, surfaces destructive ops.
Belt-and-suspenders: system prompt asks, permission hook gates.

All permission requests are logged and scanned periodically against known problem patterns.

### Two trees, one workspace
The workspace is a git repo with an **inverted `.gitignore`** — explicit allowlist. Nothing tracked except configuration, skills, knowledge, templates.

- **Tracked tree** — code, skills, subagents, hooks, sanitized knowledge.
- **`_local/` tree** — attorney work product, observations, raw client material. Never in git. Drains to R2 only through the sanitizer.

The boundary is enforced four ways:

1. Inverted gitignore + allowlist.
2. Pre-commit hook scans staged diffs against generic PII regex + dynamic per-matter patterns (party names, case numbers, addresses — once a matter 
exists locally, its values automatically become regex patterns).
3. Physical layout — work product is not designed to live in the shared tree at all.
4. Permission hook blocks tool-call writes outside expected paths.

Not airtight — symlinks could subvert it — but bash-path-checking every tool call has no ROI vs. the stack above.

### Local paths: one env var, one resolver
- `WORK_DIR` is the only env var the operator sets.
- Skill markdown uses a `<work>` prefix convention.
- All Python paths go through `scripts/path.py` and raise if the resolved path is missing.

No scattered path config, no implicit defaults.

### Multi-session Word editing via a broker
One operator-driven Word instance, N concurrent Claude sessions. Three pieces:

- **Office.js add-in** — loads in the Word taskpane, talks to broker over WebSocket. The **only** thing that writes to the document.
- **Node broker** — background process, single source of truth.
- **Per-session MCP server** — talks to broker over HTTP.

Sessions submit **typed intents** (no free-form execution). The broker holds:

- Canonical in-memory snapshot
- Append-only intent queue
- Reconciler (validates against current state, detects conflicts)
- Dispatcher (pushes validated intents to add-in over WS)
- Persistence + backups

Concurrency is optimistic, no section locks. Each intent carries a `before` hash for the target paragraph. Match → apply, push, broadcast. Mismatch → 
`stale_hash` conflict, surfaced to the submitting session and back to the agent.

A listener feeds manual operator edits back into the snapshot. The broker stays canonical.

### Citations: verification, not generation
Bluebook 21st edition with court-specific overrides. The skill formats; it does not invent. Three checks run against any cite:

1. **Cite accuracy** — independently looked up via CourtListener API.
2. **Argument support** — does the cited case actually support the proposition?
3. **Scope distinctions** — material differences the brief glosses over.

Caselaw verification goes through CourtListener and per-court public APIs, all under formal agreement. Nothing files programmatically. The attorney is 
responsible for every citation — the workbench surfaces problems, attorney decides.

### Adversarial stress tests
Roughly 15 skills review work from different perspectives — opposing-counsel adversarial read, judge-style scrutiny, multiple flavors of cite-checking. 
Each runs as an isolated subagent with bounded context, returns structured findings the attorney triages.

### Learning is shared, observations are not
Three-tier feedback loop:

- **`knowledge/memory`** — durable workspace rules. Sanitized at capture. Ripples across skills. Operator preferences, lessons, conventions.
- **`knowledge/<domain>`** — court-specific, judge-specific, template-specific notes. Same shape, scoped narrower.
- **`_local/observations`** — per-session corrections, "this skill got it wrong" notes. NOT git-tracked. Drains to R2 via the sanitizer.

A correction to the caselaw-review skill propagates across operators. A note that this user prefers extremely terse phrasing stays local.

The R2 drain is bidirectional: observations flow up to the toolsmith, skill/knowledge updates flow back via git pull. The sanitizer is a hard boundary on
both directions.

### Confidentiality
Claude Enterprise. Client data does not leave the operator's machine except through the sanitizer-gated R2 channel.

---

## Infrastructure

### Workspace runtime
Python in a `uv`-managed virtualenv. Node for the Office.js broker. Claude Desktop hosts the sessions. Everything ships as a git repo the operator clones
once and updates with `git pull`.

### Office stack
- **Word** — Office.js taskpane add-in + node broker on Windows.
- **Outlook** — Microsoft Graph via the Softeria MS365 MCP. Thin skill layer over the MCP — earlier custom broker was rolled back; the MCP was
sufficient.

### Comms substrate
Cloudflare R2 as the channel between operator and toolsmith. Sanitized observations flow up, skill/knowledge updates flow down through git. No direct
connection, no inbound listeners on the operator's machine.

### Sanitizer
PII/sensitive-data subagent. Replacement table is generic (names, addresses, emails, phone, account numbers, identifiers) plus per-matter dynamic
patterns. Runs on capture for any artifact crossing the local/shared boundary.

---

## Architecture at a glance

| Layer | Stack |
|-------|-------|
| Webapp frontend | SvelteKit, TypeScript |
| Webapp backend | Cloudflare Workers |
| Webapp storage | Cloudflare R2 |
| Webapp auth | Better Auth |
| Workbench runtime | Claude Code via Claude Desktop, Claude Enterprise |
| Workbench language | Python (`uv` venv), Node (broker) |
| Word integration | Office.js add-in + node broker + per-session MCP |
| Outlook integration | Softeria MS365 MCP over Microsoft Graph |
| Caselaw | CourtListener API + per-court public APIs |
| Operator ↔ toolsmith | Cloudflare R2 + sanitizer subagent |
| Config delivery | Git repo, inverted `.gitignore` |

---

## What's not built yet
- **Eval loop wired to the observation stream.** The `_local/observations` drain is the substrate; a harness that turns the sanitized stream into
regression signal is the next layer.
- **Operator-authored knowledge with sanitization gate.** Today, court/judge knowledge files are toolsmith-curated. Lawyer-authored knowledge that flows
through the same boundary is on the roadmap.