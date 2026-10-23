import { afterEach, describe, expect, it, vi } from 'vitest'
import { CPC_MODE_CONFIG } from '@/domain/cpc'
import type { ResizeToModeOptions } from './resize-to-mode'
import { resizeToMode } from './resize-to-mode'

const MODE_1 = CPC_MODE_CONFIG[1]

function image(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = i % 256
    data[i * 4 + 3] = 255
  }
  return new ImageData(data, width, height)
}

function options(over: Partial<ResizeToModeOptions> = {}): ResizeToModeOptions {
  return {
    modeConfig: MODE_1,
    resizeMode: 'origin',
    centerImage: true,
    resampleStrategy: 'tent',
    ...over
  }
}

/**
 * Take the 2D context away from canvases. `vitest.setup.tsx` gives every
 * canvas a fake one; the first `keep` canvases created still get it.
 *
 * The override is an own property of each element: `vi.spyOn` on
 * `getContext` would reach the shared prototype mock from the setup file and
 * leave it returning `null` for every later test.
 */
function withoutCanvasContext(keep = 0): void {
  const create = document.createElement.bind(document)
  let created = 0
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = create(tag)
    if (tag === 'canvas' && created++ >= keep) {
      Object.defineProperty(element, 'getContext', { value: () => null })
    }
    return element
  })
}

describe('resizeToMode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resamples to the target mode canvas in origin mode', () => {
    const result = resizeToMode(image(640, 400), options())

    expect(result.width).toBe(MODE_1.width)
    expect(result.height).toBe(MODE_1.height)
  })

  it('resamples to the target mode canvas in cover mode', () => {
    const result = resizeToMode(
      image(640, 400),
      options({ resizeMode: 'cover', resampleStrategy: 'lanczos2' })
    )

    expect(result.width).toBe(MODE_1.width)
    expect(result.height).toBe(MODE_1.height)
  })

  it('honours a different target mode config (the EGX case)', () => {
    const egxModeConfig = { ...MODE_1, width: 640, mode: 2 as const, scaleY: 2 }
    const result = resizeToMode(
      image(800, 600),
      options({ modeConfig: egxModeConfig })
    )

    expect(result.width).toBe(640)
    expect(result.height).toBe(egxModeConfig.height)
  })

  it.each(['origin', 'cover'] as const)(
    'resizes through the canvas for the classic strategy (%s)',
    (resizeMode) => {
      const result = resizeToMode(
        image(4, 2),
        options({ resizeMode, resampleStrategy: 'classic' })
      )

      expect(result.width).toBe(MODE_1.width)
      expect(result.height).toBe(MODE_1.height)
    }
  )

  it('needs a 2D context for the classic strategy', () => {
    withoutCanvasContext()
    const cropped = image(4, 2)

    expect(
      resizeToMode(cropped, options({ resampleStrategy: 'classic' }))
    ).toBe(cropped)
  })

  it('keeps the crop size in auto mode, left to the later normalize step', () => {
    const result = resizeToMode(image(4, 2), options({ resizeMode: 'auto' }))

    expect(result.width).toBe(4)
    expect(result.height).toBe(2)
  })

  it('returns a new image in auto mode, from the canvas round-trip', () => {
    const cropped = image(4, 2)

    expect(resizeToMode(cropped, options({ resizeMode: 'auto' }))).not.toBe(
      cropped
    )
  })

  it('returns the crop untouched when the resize throws', () => {
    // The source canvas keeps its context; the output canvas has none, so
    // `applyResize` throws.
    withoutCanvasContext(1)
    const cropped = image(4, 2)

    expect(
      resizeToMode(cropped, options({ resampleStrategy: 'classic' }))
    ).toBe(cropped)
  })
})
