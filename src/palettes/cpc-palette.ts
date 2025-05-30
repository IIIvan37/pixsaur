import { Vector } from '@/libs/pixsaur-color/src/type'
import { CPCColor, CPCPalette } from '@/libs/types'

// Full CPC hardware palette
export const cpcFullPalette: CPCColor[] = [
  { index: 0, name: 'Black', hex: '000000', vector: [0, 0, 0] },
  { index: 1, name: 'Blue', hex: '0000AA', vector: [0, 0, 128] },
  { index: 2, name: 'Bright Blue', hex: '0000FF', vector: [0, 0, 255] },
  { index: 3, name: 'Red', hex: 'AA0000', vector: [128, 0, 0] },
  { index: 4, name: 'Magenta', hex: 'AA00AA', vector: [128, 0, 128] },
  { index: 5, name: 'Mauve', hex: 'AA00FF', vector: [128, 0, 255] },
  { index: 6, name: 'Bright Red', hex: 'FF0000', vector: [255, 0, 0] },
  { index: 7, name: 'Purple', hex: 'FF00AA', vector: [255, 0, 128] },
  { index: 8, name: 'Bright Magenta', hex: 'FF00FF', vector: [255, 0, 255] },
  { index: 9, name: 'Green', hex: '00AA00', vector: [0, 128, 0] },
  { index: 10, name: 'Cyan', hex: '00AAAA', vector: [0, 128, 128] },
  { index: 11, name: 'Sky Blue', hex: '00AAFF', vector: [0, 128, 255] },
  { index: 12, name: 'Yellow', hex: 'AAAA00', vector: [128, 128, 0] },
  { index: 13, name: 'White', hex: 'AAAAAA', vector: [128, 128, 128] },
  { index: 14, name: 'Pastel Blue', hex: 'AAAAFF', vector: [128, 128, 255] },
  { index: 15, name: 'Orange', hex: 'FFAA00', vector: [255, 128, 0] },
  { index: 16, name: 'Pink', hex: 'FFAAAA', vector: [255, 128, 128] },
  { index: 17, name: 'Pastel Magenta', hex: 'FFAAFF', vector: [255, 128, 255] },
  { index: 18, name: 'Bright Green', hex: '00FF00', vector: [0, 255, 0] },
  { index: 19, name: 'Sea Green', hex: '00FFAA', vector: [0, 255, 128] },
  { index: 20, name: 'Bright Cyan', hex: '00FFFF', vector: [0, 255, 255] },
  { index: 21, name: 'Lime', hex: 'AAFF00', vector: [128, 255, 0] },
  { index: 22, name: 'Pastel Green', hex: 'AAFFAA', vector: [128, 255, 128] },
  { index: 23, name: 'Pastel Cyan', hex: 'AAFFFF', vector: [128, 255, 255] },
  { index: 24, name: 'Bright Yellow', hex: 'FFFF00', vector: [255, 255, 0] },
  { index: 25, name: 'Pastel Yellow', hex: 'FFFFAA', vector: [255, 255, 128] },
  { index: 26, name: 'Bright White', hex: 'FFFFFF', vector: [255, 255, 255] }
]

// Get the appropriate palette based on CPC mode
export function getCPCPalette(): CPCPalette {
  // Pour tous les modes, on retourne la palette complète
  // Le nombre de couleurs utilisables sera limité par le composant ColorPalette
  return cpcFullPalette
}

export function generateAmstradCPCPalette(): Vector[] {
  return cpcFullPalette.map((entry) => entry.vector)
}
// Helper functions for working with vectors
export function vectorToHex(vector: Vector): string {
  const [r, g, b] = vector
  return `${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function hexToVector(hex: string): Vector {
  const r = Number.parseInt(hex.substring(0, 2), 16)
  const g = Number.parseInt(hex.substring(2, 4), 16)
  const b = Number.parseInt(hex.substring(4, 6), 16)
  return [r, g, b]
}

const firmwareToHardware = [
  0x54, 0x44, 0x58, 0x5c, 0x4c, 0x40, 0x45, 0x41, 0x59, 0x5d, 0x49, 0x4d, 0x55,
  0x51, 0x5a, 0x5e, 0x4a, 0x42, 0x46, 0x52, 0x56, 0x4e, 0x43, 0x47, 0x53, 0x57,
  0x5f
]
export function injectPaletteDataIntoSCR(scr: Uint8Array, palette: number[]) {
  const borderIndex = palette[0] // index firmware
  const borderHw = firmwareToHardware[borderIndex]

  scr[2000] = borderIndex
  scr[2001 + 16] = borderHw

  for (let i = 0; i < 16; i++) {
    const fw = palette[i]
    scr[2001 + i] = fw
    scr[2018 + i] = firmwareToHardware[fw]
  }
}

export const getHardwarePalette = (palette: number[]) => {
  return palette.map((index) => firmwareToHardware[index])
}

export const cpcPalette = generateAmstradCPCPalette()
