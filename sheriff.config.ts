import type { SheriffConfig } from '@softarc/sheriff-core'

/**
 * Hexagonal / clean-archi boundaries verified on the REAL module graph
 * (reachable from src/main.tsx).
 *
 * STATUS: NON-BLOCKING DIAGNOSTIC (`pnpm check:arch`, report-only via `|| true`
 * — NOT in the pre-commit hook / gate). `scripts/check-layer-imports.js` stays
 * the authoritative, blocking layering guard.
 *
 * Why not blocking: pixsaur uses deep cross-module imports (e.g.
 * `@/libs/pixsaur-color/src/type`) rather than per-module public barrels, so
 * Sheriff reports ~165 "encapsulation" violations that would only clear after a
 * barrel/public-API refactor across libs/domain/features (a separate, tracked
 * initiative — see docs/refactor/PLAN-quality-gates-from-loupe.md, Phase 3).
 * Until then Sheriff runs as a RADAR: its dependency-rule violations surface
 * real layering leaks the regex guard can't see — notably dynamic `import()`
 * escapes (it already caught `core → @/tauri` in the logger, since fixed via the
 * `LogSink` port).
 *
 * Division of labour with the regex guard (they do NOT fully overlap):
 *   - Sheriff  → the INTERNAL cross-layer graph + dynamic-import escapes.
 *   - check-layer-imports.js → npm-import purity (no `jotai`/`react`/`react-dom`
 *     in libs/domain/features) + the @/test-utils spec-only rule. Sheriff does
 *     not inspect node_modules imports, so this stays authoritative for those.
 *
 * Layering (an arrow means "may import"):
 *   app → components → feature/application → domain → libs ; all → core
 *   tauri = adapters (impure, outside the hexagon)
 */
export const config: SheriffConfig = {
  version: 1,
  entryFile: 'src/main.tsx',
  enableBarrelLess: false,
  modules: {
    'src/core': 'core',
    'src/libs': 'libs',
    'src/domain': 'domain',
    'src/export': 'feature',
    'src/preview': 'feature',
    'src/palette': 'feature',
    'src/raster': 'feature',
    'src/editor': 'feature',
    'src/components': 'components',
    'src/app': 'app',
    'src/tauri': 'tauri',
    'src/assets': 'support',
    'src/styles': 'support',
    'src/locales': 'support'
  },
  depRules: {
    // core is transverse: it is a dependency TARGET but depends on no other layer.
    core: [],
    // pure libs see only core.
    libs: ['core'],
    // pure domain sees libs + core (and itself).
    domain: ['domain', 'libs', 'core'],
    // features orchestrate domain/libs; their thematic barrels re-export components.
    feature: ['feature', 'domain', 'libs', 'core', 'components'],
    // tauri adapters (impure) build on the pure core.
    tauri: ['tauri', 'domain', 'libs', 'core'],
    // components compose features and read the store (Jotai adapters live in app).
    components: [
      'components',
      'feature',
      'domain',
      'libs',
      'core',
      'app',
      'tauri'
    ],
    // app is the composition root: it may see everything.
    app: [
      'app',
      'components',
      'feature',
      'domain',
      'libs',
      'core',
      'tauri',
      'support'
    ],
    // leaf support (assets/styles/locales) imports nothing of ours.
    support: [],
    // untagged files (src/main.tsx, vite-env, wdyr) may reach the app root.
    root: 'noTag',
    noTag: ['app', 'components', 'core', 'noTag']
  }
}
