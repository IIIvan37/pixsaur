import { describe, expect, it, vi } from 'vitest'
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

/** happy-dom has no real 2D context; force the null-context fallback path. */
function withoutCanvasContext(): void {
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = create(tag)
    if (tag === 'canvas') {
      vi.spyOn(element as HTMLCanvasElement, 'getContext').mockReturnValue(null)
    }
    return element
  })
}

describe('resizeToMode', () => {
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

  it('takes the legacy canvas path for the classic strategy', () => {
    withoutCanvasContext()
    const cropped = image(4, 2)

    // No 2D context available → the image comes back untouched.
    expect(
      resizeToMode(cropped, options({ resampleStrategy: 'classic' }))
    ).toBe(cropped)
    vi.restoreAllMocks()
  })

  it('leaves auto mode to the later normalize step', () => {
    withoutCanvasContext()
    const cropped = image(4, 2)

    expect(resizeToMode(cropped, options({ resizeMode: 'auto' }))).toBe(cropped)
    vi.restoreAllMocks()
  })
})
