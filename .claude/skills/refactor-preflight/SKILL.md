---
name: refactor-preflight
description: Run the refactor guardrails (typecheck + knip dead-code + jscpd duplication) and report before opening a refactor PR. Use after extracting a use-case or before pushing any strangler-fig refactor branch, to confirm no dead code lingers and no copy-paste was introduced.
---

# Refactor preflight

Quick, report-only health check for a refactor branch. Detectors are currently
**report-only (ratchet mode)** — they inform, they don't gate. Read the output
and act; don't dismiss new findings just because the build is green.

## Run

```
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"   # WSL: node not on PATH
corepack pnpm refactor:preflight
```

This runs `tsc --noEmit`, then `knip --no-exit-code` (dead code / orphan
exports), then `jscpd src` (copy-paste). To run pieces individually:
`corepack pnpm check:dead` / `corepack pnpm check:dup`.

## How to read it

- **knip** — focus on what THIS branch changed. A use-case extraction that left
  the old helper as an unused export is the failure mode we care about: delete
  it. Distinguish your new orphans from pre-existing legacy ones (the baseline
  is noisy — that's expected in ratchet mode).
- **jscpd** — any new clone that spans the branches you just touched
  (standard/EGX/Mode-R, etc.) means shared logic should be one helper. Factor
  it. Pre-existing clones in untouched files are not this PR's job.

## Before declaring done

Also confirm the standard gate is green:

```
corepack pnpm test
corepack pnpm check        # known pre-existing failure: @radix-ui import in settings-panel.tsx
```

Report a short summary: new dead code (deleted? y/n), new duplication (factored?
y/n), tests/typecheck status. Don't pad — name only what changed.

When the step is finished (not just checked), close it with the
`/session-report` skill so `docs/refactor/STATUS.md` and the session log stay
the resumable source of truth.
