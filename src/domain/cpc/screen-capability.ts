/**
 * What a given framebuffer can become on real CPC hardware.
 *
 * The rule "mode 0 → 160×200, mode 1 → 320×200, mode 2 → 640×200, never
 * overscan" used to be written out five times across the exporters and the
 * export dialog, in four different signatures — with a comment in `export-zip`
 * reading *"Must match the UI logic in export-config-dialog.tsx"*. It lives
 * here now: one rule, every reader.
 *
 * The verdicts are hardware facts, not preferences:
 * - a **standard screen** is one the firmware can display with no tricks;
 * - an **SCR** is the 16 KB interleaved screen dump, so any framebuffer whose
 *   highest interleaved address stays under 16 KB can ship as one;
 * - a **snapshot** restores a whole machine state, which the templates only
 *   cover for a standard screen or a full overscan screen.
 */

import type { CpcModeConfig, PixelMode } from './mode-config'

/** Size of the CPC screen memory an SCR file mirrors. */
export const CPC_SCREEN_MEMORY_BYTES = 16384

/** The framebuffer geometry the verdicts depend on. */
export type ScreenGeometry = Pick<
  CpcModeConfig,
  'mode' | 'width' | 'height' | 'overscan'
>

/**
 * An EGX screen, which alternates two modes line by line and therefore has its
 * own notion of "standard": EGX1 is mode 1's 320 pixels wide, EGX2 mode 2's 640.
 */
export interface EgxScreen {
  type: 'egx1' | 'egx2'
  width: number
  height: number
}

export interface ScreenCapability {
  /** The framebuffer matches a native CPC screen — no overscan, no custom size. */
  isStandard: boolean
  /** It fits the 16 KB interleaved screen memory, so an SCR can be produced. */
  canExportScr: boolean
  /** A snapshot template exists: a standard screen, or a full overscan screen. */
  canExportSna: boolean
}

/** Pixels packed per byte in each mode. */
const PIXELS_PER_BYTE: Record<PixelMode, number> = { 0: 2, 1: 4, 2: 8 }

/** Native screen dimensions per mode. */
const STANDARD_SCREENS: Record<PixelMode, { width: number; height: number }> = {
  0: { width: 160, height: 200 },
  1: { width: 320, height: 200 },
  2: { width: 640, height: 200 }
}

/** Native EGX screen widths per type (both are 200 lines tall). */
const STANDARD_EGX_SCREENS: Record<
  EgxScreen['type'],
  { width: number; height: number }
> = {
  egx1: { width: 320, height: 200 },
  egx2: { width: 640, height: 200 }
}

/**
 * Highest address the interleaved screen layout reaches for this geometry.
 * Lines are stored in 8 interleaved banks of 2 KB, hence `(y & 7) * 2048`.
 */
export function maxScreenAddress(geometry: ScreenGeometry): number {
  const widthInBytes = geometry.width / PIXELS_PER_BYTE[geometry.mode]
  const maxY = geometry.height - 1
  return (maxY & 7) * 2048 + (maxY >> 3) * widthInBytes + (widthInBytes - 1)
}

/** True when the geometry is one the firmware displays as-is. */
export function isStandardScreen(geometry: ScreenGeometry): boolean {
  if (geometry.overscan) return false

  // Defensive: callers at the edges (DSK utils) still carry an untyped mode.
  const standard = STANDARD_SCREENS[geometry.mode]
  if (!standard) return false

  return (
    geometry.width === standard.width && geometry.height === standard.height
  )
}

/** True when the EGX screen is one of the two native EGX resolutions. */
export function isStandardEgxScreen(egx: EgxScreen): boolean {
  const standard = STANDARD_EGX_SCREENS[egx.type]
  return egx.width === standard.width && egx.height === standard.height
}

/**
 * The three verdicts for one framebuffer. Pass `egx` when the image is rendered
 * in EGX mode: the standard-screen verdict then follows the EGX resolution,
 * while the SCR fit still follows the underlying mode config (that is what gets
 * written to screen memory).
 */
export function screenCapability(
  modeConfig: ScreenGeometry,
  egx?: EgxScreen | null
): ScreenCapability {
  const isStandard = egx
    ? isStandardEgxScreen(egx)
    : isStandardScreen(modeConfig)

  const fitsScreenMemory =
    !modeConfig.overscan &&
    maxScreenAddress(modeConfig) < CPC_SCREEN_MEMORY_BYTES

  return {
    isStandard,
    canExportScr: isStandard || fitsScreenMemory,
    canExportSna: isStandard || modeConfig.overscan
  }
}
