import { Vector } from '@/libs/pixsaur-color/src/type'

export function generateAmstradCPCPalette(): Vector<'RGB'>[] {
  const palette: Vector<'RGB'>[] = []
  for (let g = 0; g < 3; g++) {
    for (let r = 0; r < 3; r++) {
      for (let b = 0; b < 3; b++) {
        palette.push([
          r === 1 ? 128 : r === 2 ? 255 : 0,
          g === 1 ? 128 : g === 2 ? 255 : 0,
          b === 1 ? 128 : b === 2 ? 255 : 0
        ])
      }
    }
  }
  return palette
}
