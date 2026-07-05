---
name: tdd-cycle
description: Drive a change through strict red-green-refactor TDD. Use for ANY change to the pure core (src/libs/** and src/domain/**) or any pure logic — write the failing test first, the minimal code to pass, then refactor under green. Enforces one-assertion-per-test and triangulation.
---

# TDD cycle (red → green → refactor)

The pure core (`src/libs/**`, `src/domain/**`) has no I/O by design — there is no
excuse to write code before a test. One micro-cycle per behavior. Never write
production code without a failing test that demands it. Two disciplines are
non-negotiable: **one assertion per test** and **triangulation** (don't
generalize the code until a test forces it).

**Double loop (outside-in).** This unit cycle is the INNER loop. Domain/lib work
is justified by an OUTER need — a use-case in `src/<feature>/application` (see
`new-feature-hexa`), or, in the strangler-fig refactor, the behavior the extracted
use-case must preserve (see `extract-use-case`). Don't add a pure function no
consumer asks for. If you can't name the failing outer test that requires a piece
of core code, don't write it.

## RED — write one failing test first

- Colocate: `<name>.spec.ts` next to the unit (happy-dom env, globals on —
  `describe`/`it`/`expect`/`vi` are ambient; see `vitest.setup.tsx`).
- **One assertion per test.** A test pins exactly ONE behavior and ends in a
  single `expect`. A second fact = a second test. (Arrange/act may be shared via
  a helper; the *assertion* is singular.) A property test counts as one
  assertion: one invariant per `it`.
- Name the test by the rule, not the function (`rejette une palette vide`). In
  this repo test names are in French — match the surrounding specs.
- For pure core logic, assert on returned values — **no mocks** (`src/libs` and
  `src/domain` are pure; the layer guard forbids Jotai/React/Tauri there anyway).
- For a use-case in `src/<feature>/application`, inject **fake ports** (in-memory
  stubs from the feature's `ports.ts`); one `it` asserts the `Result`, a separate
  `it` asserts what the fake received. No real fs/network/Tauri/canvas.
- For an invariant that must hold for all inputs, reach for **fast-check**
  property tests (used across `pixsaur-color`).
- Run and SEE IT FAIL for the right reason: `pnpm test -- <path-or-name>`.
  A test that passes immediately tested nothing — fix it before continuing.

## GREEN — minimal code to pass (fake it, then triangulate)

Take the **smallest** step that goes green, even if it looks absurd:

1. **Fake it.** Return a hardcoded constant if that's all the current test demands.
2. **Triangulate.** Add the next RED test with a *different* example the fake
   can't satisfy. Only now write enough real logic to pass both. Repeat until the
   general rule is forced out by the tests, not by guesswork.
3. Generalize **only** when ≥2 concrete examples require it. No speculative
   branches, no handling cases no test asks for.

Keep the core pure: if you reach for `window`, `document`, a file, Tauri, ReGL or
the network, the logic is in the wrong layer — put a port in the feature's
`application/ports.ts` and the impl in an adapter (`src/app/store/adapters`,
`src/tauri`, …). `scripts/check-layer-imports.js` catches the leak.

## REFACTOR — clean under green

- Improve names/structure/duplication with the tests as a safety net.
- `pnpm check:dup` (jscpd) is a ratchet — factor any NEW copy-paste into a shared
  helper (often pure domain). Don't duplicate across strategies/variants (the
  mode-0 hue-diversity presets are a deliberate, documented exception — leave them).
- Tests must stay green. If you change behavior, that's a new RED.

## Close the cycle

- Run the guardrails before declaring done: `/quality-gate`. If the change
  touched the mutated scope (`domain/cpc` or `pixsaur-color` {histogram,space,
  utils,metric}), run `pnpm test:mutation` — a surviving mutant means a test that
  covers without verifying; tighten the assertion.
- End of step (not just cycle): `/session-report`.

## Anti-patterns (stop if you catch yourself)

- **Multiple assertions in one test** — split into one `it` per fact.
- **Skipping triangulation** — jumping to the general algorithm before two
  examples force it.
- **Speculative core code** — a pure unit no outer test demands. Name the
  consumer or don't build it.
- Writing the implementation, then the test (delete and restart RED).
- A spec with no failing phase.
- Mocking the pure core. It's pure; only ports get faked.
- Loosening a type or disabling a guard to go green.
