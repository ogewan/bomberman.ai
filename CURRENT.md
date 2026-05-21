# CURRENT.md

> Live work log. Maintained by the `/current` skill. Read by `/status` and `/resume`.

## Status

Phase D — Training & Scaling: **complete**. All platform phases (0, A, B, C, D) are done. No phase currently active.

## Active work

Nothing in progress. Awaiting direction on what comes after Phase D.

## Up next

CLAUDE.md defines no phase past D — next direction is user-owned.

1. Refresh `ARCHITECTURE.md` — still describes only the v0 B26 engine; no coverage of the platform layer (platform-core, env adapters, ml-inference, platform-server, training sidecar) built across Phases A–D.
2. Re-run `/notion-link` in a session with Notion MCP to confirm/correct the hub title (may have been renamed from "Bomberman 65" post-pivot).

## Open issues / blockers

- `ARCHITECTURE.md` is stale (dated Mar 31, pre-platform-pivot). Its "What's Not Here Yet" section lists ML bots as future work, but Phases A–D shipped them.
- `.claude/notion.json` hub title unverified — written from the CLAUDE.md URL without MCP verification.

## Recent decisions

- 2026-05-01 · Rebuilt `AGENTS.md` with standard mirror structure (global + project rules); archived pre-pivot content as `AGENTS.deprecated.md` · old AGENTS.md predated the platform pivot and misled non-Claude agents.

## Scratch / context

Phase D shipped (commits `13e28e5`, `69324be`): Python training sidecar with REINFORCE loop (`apps/training/`), env-server (`apps/env-server/`), `RemoteEnvironmentProtocol` + `EnvironmentServer` (`packages/platform-server/`), throughput benchmarks (`packages/env-bomberman26/src/benchmark.ts`, `apps/training/.../benchmark.py`), and the Phase D report (`docs/benchmarks/phase-d-report.json`).
