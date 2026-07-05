---
name: new-feature-hexa
description: Build a NEW vertical slice (use-case + ports + pure core) OUTSIDE-IN — start from the consumer's need (a use-case / acceptance test), let it pull the domain into existence, then wire the adapter. Use when adding a genuinely new feature capability. For carving an EXISTING component/atom into a use-case, use extract-use-case instead.
---

# New feature (vertical slice, outside-in)

Add a NEW capability as a thin slice through pixsaur's layers, **driven from the
outside in**: the pure core (`src/domain`, `src/libs`) is a *supplier*, so its API
must be pulled into existence by a real consumer need — never pushed "just in
case". Pair with `tdd-cycle` (the inner red-green-refactor loop runs inside the
outer acceptance loop = double loop).

> **Which skill?** This one is for **greenfield** capability (no existing code to
> preserve). To move business logic OUT of an existing component/atom without
> changing behavior, use `extract-use-case` (strangler-fig) — it deletes the old
> path in the same change. Same target architecture, different starting point.

> Why outside-in: a domain function written before a consumer demands it is
> speculative. Its output shape is only known once the consumer (an atom, a UI
> action, an export format) exists. Let the consumer pin the contract.

## 0. Start from the consumer & the contract it needs

Name who will USE this and what observable result they need:
- A driving trigger (a Jotai atom write, a UI action, an export) → expressed as a
  **use-case** `(input, deps) => Promise<Result>` in `src/<feature>/application`.
- A driven side-effect (download a file, call Tauri, draw on a canvas, hit the
  network) → a **port** whose shape is dictated by its real consumer.

If the output contract isn't known because its consumer doesn't exist, **go
build/spike that consumer first**. Don't invent the shape.

## 1. Reuse before you write (anti-duplication gate)

1. Read `src/<feature>/application/README.md` — the living port/use-case registry
   (e.g. `export` already has `FileSink`, `CanvasFactory`, `PlaygroundPort`,
   `PlaygroundExporter`). Reuse a port before defining a new one.
2. Grep so you reuse, not reinvent:
   `rg "export (interface|type|function|class)" src/domain src/libs src/<feature>/application`
3. Only add a port when none fits. A new port gets a web adapter and, if it
   touches the OS, a desktop adapter — selected by a `resolveXxxPort()` seam (see
   `playground-port.ts` / `file-sink.ts`).

## 2. OUTER loop — failing acceptance test for the use-case

- `src/<feature>/application/<verb-noun>.spec.ts`: write the use-case test FIRST,
  with **fake ports** (in-memory stubs implementing the `ports.ts` interfaces)
  standing in for the real adapters. Assert the observable `Result` and what the
  fake received.
- Define the use-case signature it forces:
  `src/<feature>/application/<verb-noun>.ts` — `(input, deps) => Promise<Result>`,
  `Result` an explicit ok/error union.
- It fails because the pure core it calls doesn't exist yet. Good — that failure
  is your to-do list for the inner loop.

## 3. INNER loop — pull the pure core into existence (TDD)

- Only now create the units the outer test demands, in the right layer
  (decision tree in `docs/refactor/ADR-001-file-layout.md` / CLAUDE.md):
  CPC hardware fact → `src/domain/cpc`; generic color/image math →
  `src/libs/pixsaur-color`; other pure domain → `src/domain/*`.
  RED first per `tdd-cycle` (one assertion, fake-it, triangulate).
- Pure functions only. No `jotai`/`react`/`@tauri-apps`/ReGL/`window` — the layer
  guard (`scripts/check-layer-imports.js`) enforces it. `fast-check` for invariants.
- Stop when the outer acceptance test goes green. No extra core API.

## 4. Adapters (the only impure code) + Jotai wiring

- Implement each port: web adapter in `src/<feature>/application/adapters/`,
  desktop adapter in `src/tauri/`. Adapters may touch DOM / files / Tauri / GPU —
  they live outside the hexagon.
- Wire it in the store: a Jotai atom (`src/app/store/**`) assembles the input,
  resolves the real ports, calls the use-case, maps the `Result`. The feature dir
  never imports `jotai`/`react` — the atom is the adapter.
- Export any new public surface where the feature already does.

## 5. Prove it & register

- Guardrails green: `/quality-gate`. Knip must not flag a new orphan export — if
  it does, the export had no consumer (the smell this skill prevents): wire it or
  delete it. If the new core lands in the mutated scope, `pnpm test:mutation`.
- Append the new use-case/port to `src/<feature>/application/README.md`.

## 6. Close the step

Run `/session-report` to update `docs/refactor/STATUS.md` and append a dated report.
