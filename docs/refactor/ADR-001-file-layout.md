# ADR-001 — File layout & layering rules

**Date**: 2026-06-12 · **Statut**: accepté · **Branche**: refactor/pr0-guardrails

## Contexte

La structure de `src/` était hybride et incohérente : dossiers par couche
(`domain`, `libs`, `core`, `components`, `app`) mêlés à des dossiers par
feature (`export`, `preview`, `editor`, `raster`, `palette`), fonctions pures
éparpillées (logique de sélection de couleurs dupliquée entre
`pixsaur-adapter` et `pixsaur-color`), petits dossiers orphelins
(`src/types`, `src/source`, `src/hooks`, `src/palettes`), et aucune règle
documentée ni outillée pour savoir où ranger un nouveau fichier.

Cette ADR fixe la convention de rangement et le garde-fou qui l'applique.
Elle complète l'architecture use-cases + ports du refactor clean-archi
(voir `docs/refactor/STATUS.md` et les `application/README.md` de chaque
feature).

## Décision — couches et règles d'import

Une flèche signifie « peut importer » ; tout ce qui n'est pas listé est
interdit.

```
app/, components/  →  <feature>/application  →  domain/  →  libs/
toutes couches → core/ (logger, invariants)
tauri/ = seul point d'import @tauri-apps/* (garde dédié)
```

| Couche | Contenu | Peut importer |
|---|---|---|
| `src/core/` | primitives transverses (logger, invariant) | rien d'autre dans `src/**` |
| `src/libs/pixsaur-*` | bibliothèques d'algorithmes pures | autres libs, `@/core` |
| `src/domain/` | domaine métier pur (`cpc/`, `image-processing/`) | `@/libs`, `@/core` |
| `src/<feature>/` | export, preview, palette, raster, editor | `@/domain`, `@/libs`, `@/core`, `@/tauri` (adapters) |
| `src/app/` | racine de composition : store Jotai, wiring | tout |
| `src/components/` | UI React réutilisable (`ui/` = seul point Radix) | tout sauf l'inverse |
| `src/tauri/` | wrapper plateforme | — |
| `src/test-utils/` | helpers de specs | importable depuis les specs uniquement |

Interdits clés : `src/libs/**` et `src/domain/**` n'importent jamais `jotai`,
`react`, `@/app`, `@/components` ni les features. Les features n'importent
jamais `jotai`, `react`, `@/app` ni `@/components` (les adapters Jotai vivent
dans `src/app/store`).

### Arbre de décision — « où va cette nouvelle fonction ? »

1. Fait ou règle matériel CPC (modes, palette hardware, slots, quantization
   hardware) → `src/domain/cpc`
2. Math couleur/image générique (pas de connaissance CPC, ou CPC seulement
   via paramètres) → `src/libs/pixsaur-color`
3. Orchestration d'une action utilisateur ou d'une étape de pipeline
   (`(input, deps) => Result`) → `src/<feature>/application` (use-case)
4. Effet de bord (DOM, fichiers, GPU, horloge) → port dans
   `<feature>/application/ports.ts` + adapter dans `adapters/` (ou atome
   adaptateur dans le store)
5. Helper UI ou hook mono-consommateur → colocalisé à côté du composant
6. Transverse (log, invariant) → `src/core`

## Application — `scripts/check-layer-imports.js`

Garde data-driven (même idiome que les autres gardes maison ; pas de
dependency-cruiser ni d'ESLint, le projet est sous Biome). Branché dans
`pnpm check` et le hook pre-commit. Détecte aussi les échappements relatifs
(`../../app/...`). Les specs sont exemptées (mocks/fakes).

Limites connues (partagées avec les gardes existants) : les `import()`
dynamiques construits à l'exécution ne sont pas couverts.

`scripts/check-utils-imports.js` a été retiré : il ne matchait plus que des
chemins `@/utils/*` morts.

## Registre des exceptions (ratchet — ne peut que rétrécir)

1. **Barrels thématiques** : `src/export/index.ts` et `src/preview/index.ts`
   ré-exportent des composants UI (`ExportPanel`, `ImagePreview`…). C'est
   l'entrée « thématique » historique ; toléré dans le garde via
   `ALLOWED_EXCEPTIONS`.
2. **Shims du store (layout gelé)** : `src/app/store/config/types.ts`,
   `src/app/store/config/resize-types.ts` et le type `DskImage` dans
   `src/app/store/dsk-workspace/dsk-workspace.ts` sont des ré-exports des
   définitions canoniques (`@/domain/cpc`, `@/domain/image-processing`,
   `@/export/exports/types`, pixsaur-color `strategy-names`). **Ne pas les
   « nettoyer » en re-déclarant les types localement** — c'est le piège qui
   recréerait des définitions parallèles.
3. **`src/libs/types.ts`** : contient encore des types CPC (`CPCColor`,
   `CPCHardware`) et ModeR conceptuellement domaine. Légal sous les règles
   (domain → libs autorisé) mais à éclater un jour (CPC → `domain/cpc`,
   ModeR → `pixsaur-mode-r`). Différé volontairement.

## Non-buts

- `src/components` (≈200 fichiers) n'est **pas** déplacé vers les features.
- L'organisation interne de `src/app/store` est **gelée** pendant le
  refactor strangler-fig (les imports passent par les shims).

## Conséquences

- La logique mode-0 hue-diversity a une source unique
  (`pixsaur-color/src/quant/mode0-hue-diversity.ts`) avec deux presets
  bit-à-bit (`CPC_ADAPTER_MODE0_TUNING`, `STRATEGY_V2_MODE0_TUNING`) — ne
  pas harmoniser leurs constantes sans validation visuelle.
- `src/types`, `src/source`, `src/hooks`, `src/palettes` n'existent plus.
- knip n'ignore plus `src/types/**` ; baselines : ≤51 unused exports,
  ≤19 unused types, jscpd ≤38 clones / 1,61 %.
