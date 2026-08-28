/**
 * Source pixel aspect ratios, per platform (Q8).
 *
 * Without this table everyone assumes square pixels and is 14 % wrong on the
 * first conversion. Free entry stays possible: every consumer takes a
 * `PixelAspect`, and these presets are only the shortcuts.
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

/** The physical shape of a pixel: `x` wide for `y` tall. */
export interface PixelAspect {
  x: number
  y: number
}

export type SourcePlatform =
  | 'nes-ntsc'
  | 'nes-pal'
  | 'master-system'
  | 'snes'
  | 'game-boy'
  | 'pc'

export const SOURCE_PIXEL_ASPECT: Record<SourcePlatform, PixelAspect> = {
  'nes-ntsc': { x: 8, y: 7 },
  'nes-pal': { x: 11, y: 8 },
  'master-system': { x: 8, y: 7 },
  snes: { x: 8, y: 7 },
  'game-boy': { x: 1, y: 1 },
  pc: { x: 1, y: 1 }
}
