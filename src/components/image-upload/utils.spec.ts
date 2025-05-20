import { describe, it, expect } from 'vitest'
import { getSvgDimensions, processImageFile } from './utils'
import { mockGlobalImage } from '@/utils/test-utils'

function createFile(contents: string, type = 'image/svg+xml'): File {
  return new File([contents], 'test.svg', { type })
}

describe('image upload utils', () => {
  beforeAll(() => {
    mockGlobalImage()
  })
  describe('getSvgDimensions', () => {
    it('extracts dimensions from viewBox', async () => {
      const svg = `<svg viewBox="0 0 123 456"></svg>`
      const file = createFile(svg)
      const dims = await getSvgDimensions(file)
      expect(dims).toEqual({ width: 123, height: 456 })
    })

    it('extracts dimensions from width/height attributes', async () => {
      const svg = `<svg width="200" height="300"></svg>`
      const file = createFile(svg)
      const dims = await getSvgDimensions(file)
      expect(dims).toEqual({ width: 200, height: 300 })
    })

    it('parses width/height with units', async () => {
      const svg = `<svg width="150px" height="250px"></svg>`
      const file = createFile(svg)
      const dims = await getSvgDimensions(file)
      expect(dims).toEqual({ width: 150, height: 250 })
    })

    it('throws on invalid SVG', async () => {
      const file = createFile(`<not-an-svg></not-an-svg>`)
      await expect(getSvgDimensions(file)).rejects.toThrow(/Invalid SVG file/)
    })

    it('throws on missing dimensions', async () => {
      const svg = `<svg></svg>`
      const file = createFile(svg)
      await expect(getSvgDimensions(file)).rejects.toThrow(
        /No viewBox or width\/height attributes/
      )
    })
  })

  describe('processImageFile', () => {
    it('resolves with an HTMLImageElement for a valid image', async () => {
      // Create a small valid PNG data URL
      const base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
      const file = new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        'test.png',
        { type: 'image/png' }
      )
      const img = await processImageFile(file)
      expect(img).toBeInstanceOf(window.Image)
      expect(img.src).toMatch(/^data:image\/png/)
    })

    it('rejects for an invalid image file', async () => {
      const file = new File(['not an image'], 'test.txt', {
        type: 'text/plain'
      })
      await expect(processImageFile(file)).rejects.toThrow(
        /Invalid image|Failed to read file/
      )
    })
  })
})
