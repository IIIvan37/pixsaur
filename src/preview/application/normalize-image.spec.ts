import type { CpcModeConfig } from '@/domain/cpc'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import {
  type NormalizeImageInput,
  normalizeImage,
  type PositionNormalizedImageInput,
  positionNormalizedImage
} from './normalize-image'

const mode0: CpcModeConfig = {
  overscan: false,
  mode: 0,
  width: 4,
  height: 4,
  nColors: 16,
  scaleX: 2,
  scaleY: 1
}

function normalizeInput(
  over: Partial<NormalizeImageInput> = {}
): NormalizeImageInput {
  return {
    processed: new ImageData(2, 2),
    modeConfig: mode0,
    resizeMode: 'auto',
    resampleStrategy: 'classic',
    ...over
  }
}

function positionInput(
  over: Partial<PositionNormalizedImageInput> = {}
): PositionNormalizedImageInput {
  return {
    normalized: new ImageData(2, 2),
    modeConfig: { width: 4, height: 4 },
    resizeMode: 'auto',
    exportPalette: [
      [0, 0, 0],
      [255, 255, 255]
    ],
    centerImage: false,
    ...over
  }
}

describe('normalizeImage', () => {
  it('returns null when there is no processed image', () => {
    expect(normalizeImage(normalizeInput({ processed: null }))).toBeNull()
  })

  it('passes the processed image through untouched in origin mode', () => {
    const processed = new ImageData(2, 2)
    expect(
      normalizeImage(normalizeInput({ processed, resizeMode: 'origin' }))
    ).toBe(processed)
  })

  it('passes the processed image through untouched in cover mode', () => {
    const processed = new ImageData(2, 2)
    expect(
      normalizeImage(normalizeInput({ processed, resizeMode: 'cover' }))
    ).toBe(processed)
  })

  it('rescales to fit the CPC mode dimensions in auto mode', () => {
    // mode 0 has a 2:1 pixel aspect ratio: a 2x2 source scales to fit 4x4.
    const image = normalizeImage(
      normalizeInput({ processed: new ImageData(2, 2), resizeMode: 'auto' })
    )

    expect(image).not.toBeNull()
    expect(image?.width).toBeLessThanOrEqual(4)
    expect(image?.height).toBeLessThanOrEqual(4)
  })
})

describe('positionNormalizedImage', () => {
  it('returns null when there is no normalized image', () => {
    expect(
      positionNormalizedImage(positionInput({ normalized: null }))
    ).toBeNull()
  })

  it('passes the normalized image through untouched outside auto mode', () => {
    const normalized = new ImageData(2, 2)
    expect(
      positionNormalizedImage(
        positionInput({ normalized, resizeMode: 'origin' })
      )
    ).toBe(normalized)
  })

  it('positions the normalized image into the target canvas in auto mode', () => {
    const result = positionNormalizedImage(
      positionInput({
        normalized: new ImageData(2, 2),
        modeConfig: { width: 4, height: 4 },
        resizeMode: 'auto'
      })
    )

    expect(result?.width).toBe(4)
    expect(result?.height).toBe(4)
  })

  it('uses the palette to fill the margins (does not crash on empty palette)', () => {
    const result = positionNormalizedImage(
      positionInput({ exportPalette: [] as Vector[] })
    )

    expect(result).not.toBeNull()
  })
})
