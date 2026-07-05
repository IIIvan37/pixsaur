# PLAN — Importer les gates & skills du template `loupe`

> Plan multi-PR pour porter dans pixsaur les gates et skills qualité mis au
> point dans le projet voisin `loupe` (`/Users/ivanduchauffour/loupe`) et son
> template `hexagonal-tdd-starter`. Résumé de session à produire à chaque phase
> via `/session-report`. Point de reprise canonique : `docs/refactor/STATUS.md`.

## Principe directeur

**Loupe/template sont greenfield** → leurs gates sont *bloquantes, tolérance
zéro*. **Pixsaur est un codebase mature en refonte strangler-fig** → chaque gate
importée s'introduit **en ratchet** : report-only d'abord, on baseline
l'existant, on rend bloquant seulement une fois vert. Jamais de big-bang.

Chaque apport est **adapté** à la topologie pixsaur, jamais copié tel quel.

## Différences de topologie (à garder en tête)

| | loupe / template | pixsaur |
|---|---|---|
| Structure | monorepo pnpm (`packages/core`, `packages/web`) | single `src/` + alias `@/*` |
| Cœur pur | `packages/core/src/{domain,application}` | `src/libs/**` + `src/domain/**` |
| Archi | Sheriff (graphe de modules) | regex maison `scripts/check-layer-imports.js` + ratchet d'exceptions |
| Tests | jsdom | happy-dom, `vitest.setup.tsx` |
| Gate | composite bloquant `pnpm gate` | husky + guards, pas de composite |

## Ce que pixsaur a déjà (rien à importer)

- **knip** (`check:dead` + `knip.json`), **jscpd** (`check:dup` + `.jscpd.json`).
- Skills `extract-use-case`, `refactor-preflight`, `session-report`.
- Garde d'archi maison `scripts/check-layer-imports.js` (+ console/radix/tauri).

---

## Phase 1 — Stryker (mutation testing) · PR 1 · ✅ FAIT (branche `chore/quality-gates-from-loupe`)

N'impacte aucune gate existante. Cible le cœur math déjà bien couvert.

**Résultat mesuré (2026-07-05).** Baseline full pixsaur-color+cpc = **40.48 %**
(tiré vers le bas par le dithering/stratégies : `map-and-dither` 20 %,
`ostromoukhov-coefficients` 0.68 % — table de coefficients, `palette-strategies-v2`
27 %, `mode0-hue-diversity` 39 %). Scope initial resserré aux fichiers déjà
solides → **79.30 %** (`domain/cpc` 93 %, sous-ensemble `pixsaur-color` 76 %),
run 1m17s. Seuil `break: 72` (marge sous 79.3 pour la variance run-to-run),
`low: 80`, `high: 90`.

**Fichiers livrés** : `stryker.config.json`, `vitest.stryker.config.ts` (config
vitest dédiée : happy-dom + `vitest.setup.tsx` pour le polyfill `ImageData` +
`include` scopé aux specs purs, sinon le dry-run tire `@/libs/rasm-wasm`),
script `test:mutation`, workflow `.github/workflows/mutation.yml` (post-merge
`main`), `.gitignore` (`.stryker-tmp`, `reports/mutation`, incrémental).

**Scope de mutation actuel** (`stryker.config.json`) : `domain/cpc/**` (hors
`mode-config.ts` non couvert par un spec unitaire et `cpc-palette.ts` 56 %) +
`pixsaur-color/src/{histogram,space,utils,metric}/**`.

**Dette de mutation trackée** (à faire entrer fichier par fichier en durcissant
les tests, puis remonter `break`) :
- `pixsaur-color/src/map/**` — dithering (`map-and-dither` 20 %, `ostromoukhov` 0.68 %, `blue-noise` 59 %)
- `pixsaur-color/src/quant/**` — stratégies/sélection (27–50 %)
- `pixsaur-color/src/transform/adjust.ts` (55 %)
- `domain/cpc/{cpc-palette.ts (56 %), mode-config.ts (0 %/non couvert)}`
- `pixsaur-color/src/metric/find-closest.ts` (23 mutants no-cov — trou de couverture réel)

**Reste à faire Phase 1** : élargir le scope au fur et à mesure ; envisager de
brancher `test:mutation` dans le close-step (déjà prévu Phase 2 via le skill
`session-report`).

- Deps : `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`.
- `stryker.config.json`, **scope étroit au départ** (pur, sans GPU/GLSL/WASM) :
  - `mutate`: `src/libs/pixsaur-color/src/**/*.ts`, `src/domain/cpc/**/*.ts`
    (exclure `*.spec.ts`, `index.ts`, `*.glsl`).
  - `ignorePatterns`: `src-tauri`, `src/libs/rasm-wasm`.
  - `thresholds`: `{ high: 90, low: 80, break: 60 }` — `break` bas au départ ;
    on **mesure le score réel** avant de le fixer, puis on ratchet vers le haut.
  - `testRunner: "vitest"`, `incremental: true`, `htmlReporter → reports/mutation/`.
- Script `test:mutation`.
- CI : job `mutation` **post-merge sur `main` uniquement** (PR rapides).
- Puis élargir le scope (`mode-r`, `egx`, `raster`, `image-processing`).

⚠️ Le vitest-runner charge la config vitest (plugins react/lingui, happy-dom).
Les specs des cibles doivent être purs (pas de regl/GPU) ; sinon exclure du scope.

## Phase 2 — Skills workflow · PR 2 · ✅ FAIT

Copiés/adaptés dans `.claude/skills/` (commit `72a14a7`) :
`tdd-cycle`, `new-feature-hexa`, `quality-gate`, `react-testing-patterns`
(réécrit pour happy-dom + `@/test-utils` `renderWithI18n`/`renderWithProviders`),
`lingui-best-practices` (verbatim + références). `session-report` existant enrichi
d'une étape Stryker. `new-feature-hexa` renvoie explicitement vers
`extract-use-case` (greenfield vs strangler-fig).

Copier dans `.claude/skills/` **en adaptant** `packages/core`→`src/libs`+`src/domain`,
`packages/web`→`src`, jsdom→happy-dom :

- `tdd-cycle` — adapté aux ports/use-cases de `src/<feature>/application`.
- `new-feature-hexa` — **complète** `extract-use-case` (celui-ci =
  strangler-fig/brownfield ; new-feature-hexa = greenfield outside-in).
  Documenter quand utiliser lequel.
- `quality-gate` — recomposé sur les scripts pixsaur (Phase 5).
- `lingui-best-practices` (+ `references/`) — quasi portable.
- `react-testing-patterns` — adapter happy-dom + `vitest.setup.tsx` +
  `I18nTestingProvider` pixsaur.
- `react-doctor` — arrive avec Phase 4.
- `session-report` — **ne pas écraser** l'existant pixsaur ; juste **ajouter
  l'étape Stryker** (« si le step a touché le scope muté, lancer
  `pnpm test:mutation` et reporter le score »).

## Phase 3 — Sheriff (archi hexa) · ✅ FAIT (décision : diagnostic non-bloquant)

**Résultat réel (2026-07-05, commit `7065339`).** Sheriff installé + `sheriff.config.ts`
mappé sur les couches pixsaur, exposé via `pnpm check:arch` (`sheriff verify … || true`,
**report-only, hors gate/pre-commit**).

**Décision : NE PAS rendre Sheriff bloquant.** Pixsaur importe en profondeur
(`@/libs/pixsaur-color/src/type` …) sans barrels d'API publique → ~165 violations
d'« encapsulation » qui ne disparaîtraient qu'après un refactor barrels à travers
libs/domain/features (initiative séparée, non entreprise). `check-layer-imports.js`
**reste le guard de layering autoritaire et bloquant** (il couvre en plus la pureté
npm jotai/react que Sheriff ne voit pas).

**Valeur confirmée** : Sheriff a détecté une fuite `core → @/tauri` **invisible au
guard regex** (limite documentée : les `import()` dynamiques) — un
`await import('@/tauri')` dans `logger.logToTauri`. **Corrigé par inversion de
dépendance** : port `LogSink` dans `src/core/logger.ts`, adapter
`src/tauri/log-sink.ts`, injecté au démarrage dans `src/app/app.tsx`. `core` ne
dépend plus de rien (Sheriff : 0 violation `core→tauri`). +2 tests logger.

**Dette trackée** : le refactor barrels (pour rendre Sheriff vert/bloquant) reste
optionnel et non planifié ; Sheriff sert de radar en attendant.

### (Notes de conception d'origine — pour référence)

Approche non-bloquant → bloquant envisagée initialement :

- Deps : `@softarc/sheriff-core`.
- `sheriff.config.ts` mappé sur les couches pixsaur :
  - `entryPoints: { app: 'src/main.tsx' }`, `enableBarrelLess: true`.
  - modules : `src/core`→`core`, `src/libs`→`libs`, `src/domain`→`domain`,
    `src/{export,preview,palette,raster,editor}`→`feature`,
    `src/components`→`components`, `src/app`→`app`, `src/tauri`→`tauri`.
  - depRules (miroir de `check-layer-imports.js`) : `core: []`, `libs: ['core']`,
    `domain: ['libs','core']`, `feature: ['domain','libs','core','components']`
    (barrels), `app/components`: tout, `tauri`: I/O.
- Stratégie : `check:arch` **non-bloquant** d'abord → tune la config jusqu'au
  vert (modéliser les barrels `export/index.ts`/`preview/index.ts`→`@/components`
  via la règle de couche, pas via exception par fichier). Une fois vert +
  bloquant → **décision** : retirer `check-layer-imports.js` (Sheriff le subsume
  sur le vrai graphe). Recommandé pour ne pas maintenir deux vérités.

## Phase 4 — react-doctor + impeccable · PR 4 · ratchet

- Deps : `react-doctor`, `impeccable`.
- `check:react` : `react-doctor src --scope changed --no-telemetry` — `--scope
  changed` (bloquer les régressions, pas la dette existante). Baseline le score
  full à part.
- `check:design` : `impeccable detect src` — **non-bloquant d'abord**, mesurer
  le volume de findings avant de fixer un seuil.
- Skill `react-doctor` fournie avec.

## Phase 5 — Composite `gate` · PR 5

Une fois chaque brique verte individuellement :
```
"gate": "pnpm run \"/^(typecheck|typecheck:comprehensive|check|check:arch|test:coverage|check:dead|check:dup|check:react)$/\""
```
Brancher le pre-commit husky dessus. `check:design` et `test:mutation` restent
hors du gate rapide (mutation = CI post-merge + local au close-step).

---

## Ordre & garde-fous

1. **Stryker** (isolé) → 2. **Skills** (docs) → 3. **Sheriff** (tune→bloquant,
   retire regex) → 4. **react-doctor/impeccable** (ratchet) → 5. **gate composite**.
- Une PR par phase, close par `/session-report`.
- Aucune gate mature-codebase rendue bloquante avant d'être verte sur l'existant.

## Sources

- Template : `/Users/ivanduchauffour/Documents/Documents-this/hexagonal-tdd-starter`
- Projet React de réf. : `/Users/ivanduchauffour/loupe`
  (skills : `.claude/skills/{quality-gate,tdd-cycle,new-feature-hexa,react-doctor,react-testing-patterns,lingui-best-practices,session-report}`)
