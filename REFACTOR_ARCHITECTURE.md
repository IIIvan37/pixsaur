# Refactoring architecture proposal

Objectif : moderniser la base de code en clarifiant la séparation entre le coeur métier (color/quantize/dither), les adaptateurs (wasm, regl), et la UI — tout en améliorant la testabilité et la maintenabilité.

## Principes
- Séparation claire des couches : core (pure functions), adapters (platform-specific), UI (components), domain (business logic). 
- Fonctions pures et immutables pour les algorithmes lourds (dithering, quantization) : facilite tests et benchs.
- Définir des interfaces contractuelles pour les stratégies (PaletteStrategy, DitherEngine, ColorDistanceFn).
- Centraliser les types (Vector, ColorSpace, Palette) dans un module `libs/types` ou `libs/pixsaur-color/src/types`.
- Préserver la compatibilité par des wrappers (progressive migration).

## Structure recommandée (projet monorepo léger)

src/
- app/      -> application glue (store, view models)
- domain/   -> pure business logic (image mapping, transformations). Doit dépendre uniquement de `libs/*` types.
- libs/
  - pixsaur-color/
    - map/ (mapAndDither orchestrator)
      - index.ts (exports)
      - dither/ (bayer, yliluoma, floyd-steinberg, atkinson)
    - quant/ (quantization strategies)
    - metric/ (distance metrics)
    - space/ (color space conversions)
    - types/ (Vector types, Palette interfaces)
  - pixsaur-adapter/
    - io/ (extractBuffer, downscaleImage)
    - adapters/ (wasm, regl)
- components/ -> UI components (no algorithm contertainment)
- utils/ -> purely util helpers

## Interfaces & contracts
- DitherEngine
  - apply(pixelBuffer, options): ImageData
  - deterministic and pure; accepts typed arrays

- ColorDistanceFn
  - (a: Vector, b: Vector) => number

- PaletteStrategy
  - select(paletteCandidates, constraints): number[]

Ces interfaces permettent d'implémenter swap-in/out ditherers, distance metrics ou stratégies de palette.

## Tests & Benchmarks
- Chaque algorithme expose des tests unitaires (assertions d'égalité sur petite image) plus tests d'échantillon et tests de performances.
- Ajouter un dossier `bench/` pour micro-benchmarks (JS + WASM) afin de mesurer et comparer dither/quantize.

## Performance et architecture Node/Web
- Offload : utiliser Worker (web worker/Tauri) pour les traitements lourds (map & quantize) pour garder l'UI réactive.
- WASM : préserver le support existant (rasm-wasm) ; graduellement migrer les portions hautement optimisables.
- GPGPU : ReGL quantizer est déjà présent — définir adapter interface `Quantizer` et implémenter `ReGLQuantizer` + pure TS quantizer (fallback).

## Migration progressive (phases)
1. Types & contracts
   - Créer `libs/pixsaur-color/src/types.ts` ; refactoriser imports pour qu'on ait un contrat simple.
2. Factorisation des utilitaires color
   - Extraire `distance`, `luminance`, `space` dans `libs/pixsaur-color/src`.
3. Dithers
   - Sortir chaque implémentation dans `libs/pixsaur-color/src/map/dither/*`.
   - Ajouter tests unitaires pour chaque dither.
4. Palette strategies
   - Introduire `PaletteStrategy` interface; adapter les fonctions dans `quant`.
5. UI wiring
   - Remplacer callsites progressivement par nouveaux modules.
6. Parallelization
   - Wrapper worker : `libs/pixsaur-color/src/worker` pour exécuter map & quantize dans un Worker; create convenience API for store.

## Backward compatibility
- For any change, provide compatibility wrapper with old function signatures; keep fallback to original behavior; use feature flag or deprecation cycle to remove wrappers later.
- Introduce integration tests that run the app's major flows to validate behavior.

## Risks & mitigations
- Risk: performance regression after splitting file — mitigate by benchmark after each phase.
- Risk: tests missing coverage for corner cases — add tests & property based tests for algorithm invariants.
- Risk: dependency cycles — keep `libs/*` free of `components/` imports.

## Checklist & next tasks
- [ ] Create `libs/pixsaur-color/src/types` and update imports
- [ ] Unit tests for `metric` and `space` modules
- [ ] Extract `map/dither` algorithms into separate files
- [ ] Add `PaletteStrategy` interface + tests
- [ ] Worker wrapper + store integration

---
Fin du plan. Je peux commencer la phase 1 (types & contracts) et ouvrir des PRs sur la branche `refactoring`. Tu veux que je commence par ça ?
