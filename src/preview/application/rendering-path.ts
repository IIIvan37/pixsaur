/**
 * Rendering paths — which pipeline produces the preview, and what it supports.
 *
 * Pixsaur has four mutually exclusive ways to turn the source image into a CPC
 * picture. They were never modelled: each consumer re-derived "which one is
 * active" from the raw config flags, with its own precedence, and each
 * capability gap (Mode R ignores manual edits, raster has no 16-slot palette)
 * lived only as an implicit `null` somewhere down the atom graph.
 *
 * This module is the single answer to both questions:
 * - {@link resolveRenderingPath} — which path is active, decided once.
 * - {@link renderingPathCapabilities} — what that path supports, **declared**.
 *
 * Adding a fifth path means adding a row to `RENDERING_PATH_CAPABILITIES`; the
 * `switch` at every dispatch site then stops compiling until it is handled.
 */

/** The four mutually exclusive rendering paths, in precedence order. */
export const RENDERING_PATHS = ['mode-r', 'egx', 'raster', 'standard'] as const

export type RenderingPathId = (typeof RENDERING_PATHS)[number]

/** The config flags the active path is derived from. */
export type RenderingPathFlags = {
  readonly modeREnabled: boolean
  readonly egxEnabled: boolean
  readonly rasterEnabled: boolean
  /** Number of per-scanline palette changes currently defined. */
  readonly rasterChangeCount: number
}

/**
 * What a rendering path offers to the rest of the app. Every `false` here is a
 * real gap in today's code, not a design intent — the doc comment on each row
 * says which one.
 */
export type RenderingPathCapabilities = {
  /** Manual pixel edits are applied to this path's output. */
  readonly manualEdits: boolean
  /** The pixel editor can be entered while this path is active. */
  readonly editor: boolean
  /** The path publishes one index buffer (one palette index per pixel). */
  readonly indexBuffer: boolean
  /** The path publishes a 16-slot palette for the color-palette panel. */
  readonly displayPalette: boolean
  /**
   * The path forces dithering to `'none'` while distinct mapping is active
   * (CPC Classic + mode 0 + `autoDistinctMapping`), to preserve the exact
   * one-color-per-ink mapping.
   */
  readonly distinctMappingForcesNoDither: boolean
}

/**
 * The capability matrix as it stands today. Read it as documentation of the
 * asymmetries between the paths, not as a wish list.
 */
export const RENDERING_PATH_CAPABILITIES: Record<
  RenderingPathId,
  RenderingPathCapabilities
> = {
  /** The reference path. Everything else is measured against it. */
  standard: {
    manualEdits: true,
    editor: true,
    indexBuffer: true,
    displayPalette: true,
    distinctMappingForcesNoDither: true
  },
  /**
   * Per-scanline palette changes on top of the standard pipeline.
   * `displayPalette: false` — the panel shows `RasterBasePalette` (the
   * pre-raster global palette) instead of the 16 slots, because "the" palette
   * changes from line to line.
   * `distinctMappingForcesNoDither: false` — the raster buffer dithers from the
   * raw dithering config with per-line palettes.
   */
  raster: {
    manualEdits: true,
    editor: true,
    indexBuffer: true,
    displayPalette: false,
    distinctMappingForcesNoDither: false
  },
  /**
   * Line-by-line mode alternation. Carries its own palette and its own
   * quantizer, and applies manual edits like the standard path.
   * `distinctMappingForcesNoDither: false` — EGX reads the raw dithering atom.
   */
  egx: {
    manualEdits: true,
    editor: true,
    indexBuffer: true,
    displayPalette: true,
    distinctMappingForcesNoDither: false
  },
  /**
   * Dual-image interlacing. The odd one out: it produces **two** index buffers
   * and **two** palettes, so nothing downstream that assumes a single buffer
   * applies.
   * `indexBuffer: false` — there is no single buffer to expose.
   * `manualEdits: false` / `editor: false` — the editor cannot represent two
   * frames, so the edit button is hidden and pending edits stay inert.
   * `displayPalette: false` — the color-palette panel has no dual-palette view.
   * `distinctMappingForcesNoDither: false` — Mode R reads the raw dithering
   * atom into its own `ModeRConfig`.
   */
  'mode-r': {
    manualEdits: false,
    editor: false,
    indexBuffer: false,
    displayPalette: false,
    distinctMappingForcesNoDither: false
  }
}

/** What the given rendering path supports. */
export function renderingPathCapabilities(
  path: RenderingPathId
): RenderingPathCapabilities {
  return RENDERING_PATH_CAPABILITIES[path]
}

/**
 * The active rendering path.
 *
 * The three alternate modes are kept mutually exclusive by the config setters,
 * so the precedence only decides what happens if that invariant ever leaks:
 * Mode R > EGX > raster > standard.
 *
 * Raster counts as active only once it carries at least one change — an enabled
 * raster mode with an empty change list renders exactly like the standard path.
 */
export function resolveRenderingPath(
  flags: RenderingPathFlags
): RenderingPathId {
  if (flags.modeREnabled) return 'mode-r'
  if (flags.egxEnabled) return 'egx'
  if (flags.rasterEnabled && flags.rasterChangeCount > 0) return 'raster'
  return 'standard'
}
