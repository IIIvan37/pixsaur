import { describe, expect, it } from 'vitest'
import { isProcessedImage, isSourceImage } from './image'

describe('image types', () => {
  it('detects processed images (ImageData)', () => {
    const data = new ImageData(2, 2)
    expect(isProcessedImage(data)).toBe(true)
  })

  it('detects source images (HTMLImageElement)', () => {
    const img = new Image()
    expect(isSourceImage(img)).toBe(true)
  })

  it('returns false for unrelated types', () => {
    expect(isProcessedImage({} as any)).toBe(false)
    expect(isSourceImage({} as any)).toBe(false)
  })
})
