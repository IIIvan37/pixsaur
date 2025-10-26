import { adjustContrast } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-contrast'

describe('adjustContrast', () => {
  it('réduit le contraste', () => {
    const src = new Uint8ClampedArray([0, 128, 255, 255])
    const out = adjustContrast(src, 0.5)
    // 0→64, 128→128, 255→191
    expect(Array.from(out)).toEqual([64, 128, 192, 255])
  })
})
