---
name: extract-use-case
description: Strangler-fig recipe to extract business orchestration out of a React component or Jotai atom into a pure, testable use-case with light ports. Use when refactoring a feature toward the use-cases + ports architecture (see docs in src/<feature>/application/README.md). Forces reuse of existing ports and deletion of the old code path — no parallel duplicates.
---

# Extract a use-case (strangler-fig)

Goal: move business orchestration out of UI (components/atoms) into a **pure async
function** `(input, deps) => Promise<Result>`, leaving the UI as a thin adapter.
The hard rule: **the old path is deleted in the same change** — never leave the
new and old orchestration side by side (that is exactly the duplication we are
fighting).

## 0. Locate & scope

- Identify the single handler / orchestration block to extract (e.g. a
  `handleX` in a component, or an imperative atom). One use-case per pass.
- Read it fully. List its inputs (atom reads, props) and its side-effects
  (DOM, Tauri, file download, network, canvas).

## 1. Reuse before you write (the anti-duplication gate)

Do this BEFORE writing any new code:

1. Read `src/<feature>/application/README.md` (the living registry). If the
   feature folder doesn't exist yet, this is the first use-case — you will seed it.
2. `grep` existing ports and use-cases so you reuse, not reinvent:
   - `rg "export (interface|type|function)" src/<feature>/application src/**/ports.ts`
   - search for an existing helper that already does a sub-step before adding one.
3. If a side-effect already has a port (e.g. `PlaygroundPort`, `FileSink`,
   `CanvasFactory`), reuse it. Only define a new port when none fits.

## 2. Define the use-case (pure)

- File: `src/<feature>/application/<verb-noun>.ts`.
- Signature: `function <verbNoun>(input: <Input>, deps: <Deps>): Promise<Result>`.
- `Result` is an explicit success/error union — no throwing for expected
  failures: `type Result = { ok: true; ... } | { ok: false; error: string }`.
- NO imports of `react`, `jotai`, `@tauri-apps/*`, and no direct `document.*`.
  Every impure dependency arrives via `deps` (a port). Pure domain/libs
  (`@/domain/*`, `@/libs/*`, encoders in `@/export/exports`) may be called directly.
- Ports live in `src/<feature>/application/ports.ts` (interfaces only).

## 3. Test the use-case without Jotai/React

- `src/<feature>/application/<verb-noun>.spec.ts`.
- Inject fake `deps` (in-memory port stubs). Assert on the returned `Result`
  and on what the stubs received. No store, no rendering.

## 4. Rewire the UI as a thin adapter

- The component/atom now only: assembles `input` from atoms, injects the REAL
  ports (web adapter on web, Tauri adapter from `src/tauri/`), calls the
  use-case, maps `Result` → notification/state.
- Cross-feature wiring of atoms → input may go in a `useXActions()` hook.

## 5. Delete the old path + prove no duplication

In the SAME change:

- Remove the inlined orchestration that the use-case replaced.
- `pnpm check:dead` (knip) — the old helpers you replaced must NOT linger as
  orphan exports. If knip reports them, delete them.
- `pnpm check:dup` (jscpd) — confirm you didn't copy-paste shared logic across
  branches (e.g. standard/EGX/Mode-R). Factor common steps into one helper.

## 6. Update the registry

Append to `src/<feature>/application/README.md`: the new use-case (name,
input/result), and any new port + its adapters. This is what the next
extraction reads in step 1.

## 7. Green gate

Run, in order, and fix before finishing:

```
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"   # WSL: node not on PATH
corepack pnpm typecheck
corepack pnpm test -- src/<feature>/application
corepack pnpm check:fix
```

Keep the change small enough to be one reviewable PR. If it sprawls across
multiple use-cases, stop and split.

## 8. Close the step

Run the `/session-report` skill before stopping: it updates
`docs/refactor/STATUS.md` and appends a dated report so the next session resumes
cleanly. Never end a refactor step without it.
