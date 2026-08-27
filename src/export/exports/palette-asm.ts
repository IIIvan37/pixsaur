/**
 * Palette ASM emission — the one place that turns a palette into Z80 source.
 *
 * Three shapes exist on the CPC and each had been re-derived at every export
 * site: the raw firmware indices (`DB`), the firmware indices mapped through
 * the hardware table (`DB`), and the CPC Plus 12-bit values (`DEFW`).
 */

import { firmwareToHardware } from './cpc-format'

/** Hardware value used when a firmware index has no mapping (black). */
export const HARDWARE_BLACK = 0x54

/** CPC hardware has 16 palette slots, whatever the mode uses. */
const CPC_SLOT_COUNT = 16

export interface PaletteAsmOptions {
  /** ASM label the section is emitted under. */
  label: string
  /** How many slots to emit. Defaults to the 16 CPC slots. */
  colorCount?: number
}

const hex = (value: number, digits: number): string =>
  `#${value.toString(16).padStart(digits, '0').toUpperCase()}`

/**
 * `Label:` followed by a `DB` row of one byte per slot.
 * The byte values are emitted as-is — no firmware/hardware translation.
 */
export function dbPaletteSection(bytes: number[], label: string): string {
  return `${label}:
    DB      ${bytes.map((byte) => hex(byte, 2)).join(',')}`
}

/**
 * Firmware palette indices → hardware bytes → `DB` section.
 * An index with no hardware mapping falls back to black.
 */
export function hardwarePaletteAsm(
  paletteFirmware: number[],
  { label, colorCount = CPC_SLOT_COUNT }: PaletteAsmOptions
): string {
  return dbPaletteSection(
    paletteFirmware
      .slice(0, colorCount)
      .map((fw) => firmwareToHardware[fw] ?? HARDWARE_BLACK),
    label
  )
}

/** CPC Plus 12-bit palette values → `Label:` + a `DEFW` row. */
export function plusPaletteAsm(
  cpcPlusValues: number[],
  { label, colorCount = CPC_SLOT_COUNT }: PaletteAsmOptions
): string {
  const values = cpcPlusValues
    .slice(0, colorCount)
    .map((value) => hex(value, 4))
    .join(', ')

  return `${label}:
    DEFW ${values}`
}
