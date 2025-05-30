import { describe, expect, it } from 'vitest'
import { mapAndDither } from './map-and-dither'
import { DitheringConfig } from '../quant'
import { rgbToLab } from '../space/convert'
import type { Vector } from '../type'

describe('mapAndDither (Lab, no dithering)', () => {
  it('mappe correctement une image RGBA 2x2 avec palette Lab N/B/R/B', () => {
    const rgba = new Uint8ClampedArray([
      // 2x2 RGBA
      0,
      0,
      0,
      255, // pixel 0 → noir
      255,
      255,
      255,
      255, // pixel 1 → blanc
      255,
      0,
      0,
      255, // pixel 2 → rouge
      0,
      0,
      255,
      255 // pixel 3 → bleu
    ])

    const width = 2
    const height = 2

    const paletteRgb: Vector<'RGB'>[] = [
      [0, 0, 0], // noir
      [255, 255, 255], // blanc
      [255, 0, 0], // rouge
      [0, 0, 255] // bleu
    ]
    const paletteLab = paletteRgb.map(rgbToLab)

    const config: DitheringConfig = {
      mode: 'none',
      intensity: 1
    }

    const out = mapAndDither(rgba, width, height, paletteLab, config, 'Lab')

    expect(out).toEqual(
      new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 255, 255
      ])
    )
  })
})
