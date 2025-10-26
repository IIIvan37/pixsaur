import { adjustLightness } from '@/libs/pixsaur-color/src/transform/color-transform/adjust-brighteness'

describe('adjustLightnessLab', () => {
  it('éclaircit un gris moyen', () => {
    // gris moyen L*≈53 → 128,128,128
    const src = new Uint8ClampedArray([128, 128, 128, 255])
    const out = adjustLightness(src, 20) // augmente L* de 20
    // on s’attend à un gris plus clair
    expect(out[0]).toBeGreaterThan(128)
    expect(out[1]).toBeGreaterThan(128)
    expect(out[2]).toBeGreaterThan(128)
  })

  it('assombrit un blanc', () => {
    const src = new Uint8ClampedArray([255, 255, 255, 255])
    const out = adjustLightness(src, -50)
    // blanc devrait devenir gris clair
    expect(out[0]).toBeLessThan(255)
  })
})
