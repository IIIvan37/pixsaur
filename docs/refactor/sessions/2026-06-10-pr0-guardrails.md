# Session report — 2026-06-10 — PR0 guardrails

## Goal of the session
Stand up the anti-duplication / dead-code guardrails and the repeatable
playbook before any code moves, for the clean-archi strangler-fig refactor.

## Done
- Decided strategy: incremental strangler-fig (no rewrite); target = use-cases +
  light ports; pilot feature = Export; detectors report-only with ratchet.
- Installed `knip` 6.16.1 + `jscpd` 5.0.6 (devDeps).
- Configs: `knip.json`, `.jscpd.json` (report-only, not in blocking `pnpm check`).
- Scripts: `check:dead` (knip), `check:dup` (jscpd), `refactor:preflight`.
- Skills: `.claude/skills/extract-use-case/`, `.claude/skills/refactor-preflight/`.
- Living registry seeded: `src/export/application/README.md`.
- Session-report mechanism: `docs/refactor/STATUS.md` + `sessions/_TEMPLATE.md`.
- Captured baselines (see Guardrail status).

## Not done / remaining
- Nothing committed yet (awaiting user's commit decision).
- PR1–PR4 of the export pilot not started.
- Known real duplication left for later: `validate-custom-dimensions.ts`
  duplicated in `src/preview/` and `src/source/`.

## Decisions taken
- Detectors **report-only / ratchet**, kept OUT of the blocking `pnpm check` and
  pre-commit, because the legacy base already has dead/dup code — gating day 1
  would block everything.
- Created all three of: `/extract-use-case`, `/refactor-preflight`, living registry.
- `CLAUDE.md` left untracked & untouched (pre-existing, not part of this work).

## Guardrail status
- jscpd: 2.03% dup / 45 clones (baseline, no regression)
- knip: 25 unused files / 62 unused exports (baseline, no regression)
- typecheck / tests: not re-run this session (no src logic changed; only config
  + docs + skills added).

## State to resume from
- Branch: `refactor/pr0-guardrails` · committed? no
- Next action: commit PR0, then start PR1 — define export ports + remove the
  Tauri leak in `src/export/exports/exporters/export-cpc-playground.ts`, driven
  by the `/extract-use-case` skill.
- Watch out for: WSL PATH quirk (`export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"`);
  `pnpm check` has a pre-existing failure (`@radix-ui` import in `settings-panel.tsx`)
  unrelated to this work.
