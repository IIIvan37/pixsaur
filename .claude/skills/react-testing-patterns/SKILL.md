---
name: react-testing-patterns
description: React component and hook testing idiom for pixsaur (Testing Library + Vitest + happy-dom). Use when writing or reviewing any *.spec.tsx — component rendering, user interaction, async assertions, renderHook. Complements tdd-cycle (which owns red-green-refactor); this skill owns HOW the React tests are written in this repo.
---

# React testing patterns (pixsaur)

This repo's stack: **Vitest + happy-dom + Testing Library**, globals on (no
per-file `describe`/`it`/`expect`/`vi` imports), setup in `vitest.setup.tsx`
(polyfills `ImageData`/canvas, stubs `@lingui/react` so French copy resolves).
Colocated `*.spec.tsx` next to the component.

**Core principle: test behavior, not implementation.** Never assert internal
state, CSS-module class names, or which hooks were called. One assertion per test
(`tdd-cycle` rule) — a second fact is a second `it`.

## Rendering — use the `@/test-utils` helpers, not raw `render`

`src/test-utils/index.tsx` wraps the providers this app needs. Pick by what the
component consumes:

```tsx
import { screen } from '@testing-library/react'
import { renderWithI18n, renderWithProviders, renderWithJotai } from '@/test-utils'

renderWithI18n(<ExportPanelView onExport={fn} />)   // uses Trans/useLingui only
renderWithProviders(<PreviewPanel />)                // uses Jotai atoms AND i18n
renderWithJotai(<SomeAtomConsumer />)                // Jotai only
```

`@/test-utils` is spec-only (the layer guard forbids it in production code).
Other helpers there: `mockGlobalImage()`, `createTestImageData(...)`,
`createGradientImageData(...)` for image-pipeline specs.

## Queries — priority order

Prefer the highest available: `getByRole` → `getByLabelText` → `getByText` →
`getByDisplayValue`. `getByTestId` is a last resort — if a test needs a test id,
prefer fixing the component's semantics (add a role / accessible label).

**French accessible names.** The catalog is French and `vitest.setup.tsx` stubs
Lingui to return the French message. Query with a case-insensitive regex on the
visible copy — the established idiom in this repo:

```tsx
screen.getByRole('button', { name: /Exporter/i })
```

A regex tolerates surrounding whitespace/icons and minor copy tweaks. For portals
/ dialogs, query via `screen` (whole document), never via `container`.

## Interactions — `userEvent` first, `fireEvent` for the exceptions

Default to `@testing-library/user-event`: it dispatches the full real-browser
event sequence where `fireEvent.click` fires a single synthetic event.

```tsx
import userEvent from '@testing-library/user-event'

await userEvent.click(screen.getByRole('button', { name: /Exporter/i }))
await userEvent.type(screen.getByLabelText(/Nom/i), 'Mon projet')
```

`fireEvent` is the RIGHT tool for the cases `user-event` can't drive:

1. **Range sliders** — `fireEvent.change(slider, { target: { value: '75' } })`
   (`<input type="range">` can't be driven by `user-event`).
2. **Coordinate pointer gestures** — canvas paint / drag-select with
   `pointerDown`/`pointerMove`/`pointerUp` + `clientX/Y` against a mocked
   `getBoundingClientRect`.
3. **Tests under `vi.useFakeTimers`** — `userEvent.click` hangs on a fake clock;
   use `fireEvent` there, with a comment.

Everything else — clicks, typing, tabbing — uses `userEvent`.

## Async — `findBy*` > `waitFor` > manual `act`

- Element appears asynchronously → `await screen.findByRole(...)` (it IS
  `getBy` + `waitFor`).
- Waiting on a disappearance or a non-query condition → `waitFor`, with **exactly
  one assertion inside the callback** (multiple assertions there fail
  intermittently — `findBy` first, then a plain `expect`).
- **Never wrap `render`, `fireEvent`, or `userEvent` in `act()`** — Testing
  Library already does. Manual `act()` is legitimate in two places only:
  1. `renderHook` tests calling the hook's API imperatively
     (`act(() => result.current.reset())`);
  2. advancing fake timers (`act(() => { vi.advanceTimersByTime(300) })`).

## Fakes, not mocks

- **Never mock the pure core** (`src/domain`, `src/libs` are pure — call them).
- **Never mock the unit under test's internals** — for a use-case, inject a fake
  at the port boundary (`src/<feature>/application/ports.ts` in-memory stub); for
  a component, pass fake callbacks/props. See `export-panel-view.spec.tsx` (fake
  `onExport`/`onOpenInPlayground`) and the `application/*.spec.ts` use-case specs.
- `renderHook` fakes must be **created once outside the hook callback** — building
  them inside re-creates identity on every render and yields false failures:
  `const deps = fakeDeps()` first, then `renderHook(() => useX(deps))`.
- `vi.mock()` calls are hoisted — never place them inside `describe`/`it`
  (top-of-file only, e.g. `vi.mock('@/components/ui/icon')`).

## What NOT to write

- Snapshot tests on dynamic content (ids, dates, generated buffers) — assert inline.
- Assertions on internal `useState`, CSS-module class names, or hook call counts.
- A `waitFor` whose callback holds more than one `expect`.
- A manual `cleanup()` — Testing Library auto-cleans per test.
