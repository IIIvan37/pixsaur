import { adjustSaturation } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-saturation'

describe('adjustSaturation', () => {
  it('désature complètement', () => {
    const src = new Uint8ClampedArray([255, 0, 0, 255])
    const out = adjustSaturation(src, 0)
    // rouge→gris (L=0.5) → 128
    expect([out[0], out[1], out[2], out[3]]).toEqual([128, 128, 128, 255])
  })
})
