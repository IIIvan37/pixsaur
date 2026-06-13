import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  validateFileSize,
  validateImageDimensions
} from './validate-image-file'

function fileOfSize(bytes: number): File {
  // Build a File reporting the requested size without allocating it.
  const file = new File([''], 'image.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

function imageOfSize(width: number, height: number): HTMLImageElement {
  return {
    naturalWidth: width,
    naturalHeight: height,
    width,
    height
  } as HTMLImageElement
}

describe('validateFileSize', () => {
  it('accepts a file at the limit', () => {
    expect(validateFileSize(fileOfSize(MAX_FILE_SIZE_BYTES)).ok).toBe(true)
  })

  it('accepts a small file', () => {
    expect(validateFileSize(fileOfSize(1024)).ok).toBe(true)
  })

  it('rejects a file over the limit', () => {
    const result = validateFileSize(fileOfSize(MAX_FILE_SIZE_BYTES + 1))
    expect(result).toEqual({ ok: false, reason: 'file-too-large' })
  })
})

describe('validateImageDimensions', () => {
  it('accepts an image at the limit', () => {
    const img = imageOfSize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
    expect(validateImageDimensions(img).ok).toBe(true)
  })

  it('rejects an image too wide', () => {
    const img = imageOfSize(MAX_IMAGE_DIMENSION + 1, 100)
    expect(validateImageDimensions(img)).toEqual({
      ok: false,
      reason: 'dimensions-too-large'
    })
  })

  it('rejects an image too tall', () => {
    const img = imageOfSize(100, MAX_IMAGE_DIMENSION + 1)
    expect(validateImageDimensions(img)).toEqual({
      ok: false,
      reason: 'dimensions-too-large'
    })
  })

  it('falls back to width/height when natural dimensions are absent', () => {
    const img = {
      width: MAX_IMAGE_DIMENSION + 1,
      height: 10
    } as HTMLImageElement
    expect(validateImageDimensions(img).ok).toBe(false)
  })
})
