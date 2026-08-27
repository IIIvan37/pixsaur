/**
 * Shared image-format decisions for the two DSK workspace exporters
 * (`export-dsk-workspace.ts` → the .dsk itself, `export-dsk-workspace-zip.ts` →
 * the .zip bundle around it).
 *
 * Both walk the same fork — standard CPC screen → SCR with an injected palette,
 * anything else → linear chunks — and both used to carry their own copy of the
 * mode-config shape, the standard-mode test and the SCR producer. One producer
 * here, two callers: they cannot drift.
 */

import type { CpcModeConfig } from '@/domain/cpc'
import { injectPaletteDataIntoSCR } from '../cpc-format'
import { injectCPCPlusPaletteIntoSCR } from '../cpc-plus-format'
import { exportSCR } from '../export-scr/export-scr'
import type { DskImage } from '../types'

/**
 * Project a workspace image onto the encoders' mode config. The workspace
 * stores the mode fields flat on the image; every encoder wants them as a
 * {@link CpcModeConfig}.
 */
export function toDskModeConfig(image: DskImage): CpcModeConfig {
  return {
    mode: image.mode,
    width: image.width,
    height: image.height,
    overscan: image.overscan,
    nColors: image.nColors,
    scaleX: image.scaleX,
    scaleY: image.scaleY
  }
}

/**
 * Encode `indexBuf` as a standard SCR and inject the image's palette — the CPC
 * Plus 16-bit palette when the image targets Plus hardware (the mode byte at
 * offset 2034 goes with it), the firmware palette otherwise.
 */
export function generateDskStandardScr(
  indexBuf: Uint8Array,
  modeConfig: CpcModeConfig,
  image: DskImage
): Uint8Array {
  const scrData = exportSCR(indexBuf, modeConfig)

  if (image.cpcHardware === 'plus' && image.palettePlus) {
    injectCPCPlusPaletteIntoSCR(scrData, image.palettePlus)
    scrData[2034] = image.mode
  } else {
    injectPaletteDataIntoSCR(scrData, image.paletteFirmware, image.mode)
  }

  return scrData
}
