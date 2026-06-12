import type { CpcModeConfig } from '@/domain/cpc'
import { type SmoothImageInput, smoothImage } from './smooth-image'

const mode0: CpcModeConfig = {
  overscan: false,
  mode: 0,
  width: 4,
  height: 4,
  nColors: 16,
  scaleX: 2,
  scaleY: 1
}

function input(over: Partial<SmoothImageInput> = {}): SmoothImageInput {
  return {
    resized: new ImageData(2, 2),
    horizontalSmoothing: true,
    pixelMode: 0,
    autoDistinctMapping: false,
    cpcHardware: 'plus',
    modeConfig: mode0,
    resizeMode: 'auto',
    resampleStrategy: 'classic',
    ...over
  }
}

describe('smoothImage', () => {
  it('returns null when there is no resized image', () => {
    expect(smoothImage(input({ resized: null }))).toBeNull()
  })

  it('returns the resized image untouched when smoothing is off', () => {
    const resized = new ImageData(2, 2)
    expect(smoothImage(input({ resized, horizontalSmoothing: false }))).toBe(
      resized
    )
  })

  it('returns the resized image untouched when the pixel width is 1', () => {
    // pixelMode 2 maps to width 1 — nothing to average.
    const resized = new ImageData(2, 2)
    expect(smoothImage(input({ resized, pixelMode: 2 }))).toBe(resized)
  })

  it('skips smoothing when distinct-mapping is active (CPC Classic + Mode 0)', () => {
    const resized = new ImageData(2, 2)
    expect(
      smoothImage(
        input({
          resized,
          autoDistinctMapping: true,
          cpcHardware: 'classic',
          modeConfig: { ...mode0, nColors: 16 }
        })
      )
    ).toBe(resized)
  })

  it('still smooths when distinct-mapping is set but hardware is Plus', () => {
    const resized = new ImageData(2, 2)
    const out = smoothImage(
      input({ resized, autoDistinctMapping: true, cpcHardware: 'plus' })
    )
    expect(out).not.toBe(resized)
    expect(out).not.toBeNull()
  })

  it('applies smoothing when enabled, not distinct-mapped, and width > 1', () => {
    const resized = new ImageData(2, 2)
    const out = smoothImage(input({ resized, pixelMode: 0 }))
    // A fresh smoothed ImageData is returned, not the input.
    expect(out).not.toBe(resized)
    expect(out?.width).toBe(2)
    expect(out?.height).toBe(2)
  })

  it('skips the box blur after a linear resample in origin/cover mode', () => {
    // Non-classic strategy already anti-aliased the resize, so a second blur
    // would undo the gain — the resized image is returned untouched.
    const resized = new ImageData(2, 2)
    for (const resizeMode of ['origin', 'cover'] as const) {
      expect(
        smoothImage(
          input({ resized, resizeMode, resampleStrategy: 'lanczos2' })
        )
      ).toBe(resized)
    }
  })
})
