import { SOURCE_PIXEL_ASPECT } from './pixel-aspect'

describe('SOURCE_PIXEL_ASPECT', () => {
  it('stretches a NES PAL pixel wider than a NES NTSC one', () => {
    const { x, y } = SOURCE_PIXEL_ASPECT['nes-pal']

    expect(x / y).toBeGreaterThan(
      SOURCE_PIXEL_ASPECT['nes-ntsc'].x / SOURCE_PIXEL_ASPECT['nes-ntsc'].y
    )
  })
})
