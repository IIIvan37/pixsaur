import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processorFactory } from '@/libs/pixsaur-adapter'
import { ReGLProcessor } from '@/libs/pixsaur-adapter/adapters/regl-processor'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { createRasterPreviewImageData } from '@/libs/pixsaur-raster/render-with-raster'
import type { RasterChange } from '@/libs/pixsaur-raster/types'

function makePalette(
  overrides: Partial<Record<number, Vector>> = {}
): Vector[] {
  const base: Vector[] = new Array(16).fill(0).map(() => [0, 0, 0]) as Vector[]
  for (const [k, v] of Object.entries(overrides)) {
    base[Number(k)] = v as Vector
  }
  return base
}

describe('processorFactory and processor lifecycle', () => {
  const realConsoleWarn = console.warn
  beforeEach(() => {
    // Silence expected warnings during tests
    console.warn = () => {}
  })
  afterEach(() => {
    console.warn = realConsoleWarn
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('createBestProcessor("cpu") returns a CPU-backed ReGLProcessor and dispose() is idempotent', async () => {
    const proc = await processorFactory.createBestProcessor('cpu')
    expect(proc).toBeInstanceOf(ReGLProcessor)
    expect(proc.isAvailable).toBe(true)

    // Simple smoke for raster preview equals CPU path
    const width = 2
    const height = 1
    const buffer = new Uint8Array([0, 1])
    const palette = makePalette({ 0: [1, 2, 3], 1: [4, 5, 6] })
    const changes: RasterChange[] = []

    const img = proc.renderRasterPreview(
      buffer,
      width,
      height,
      palette,
      changes
    )
    const cpu = createRasterPreviewImageData(
      buffer,
      width,
      height,
      palette,
      changes
    )
    expect(Array.from(img.data)).toEqual(Array.from(cpu.data))

    // dispose twice should not throw
    expect(() => proc.dispose()).not.toThrow()
    expect(() => proc.dispose()).not.toThrow()
  })

  it('falls back to CPU when ReGL creation fails', async () => {
    // Mock `regl` module to throw on creation
    vi.doMock('regl', () => ({
      __esModule: true,
      default: () => {
        throw new Error('WebGL not available')
      }
    }))

    // Re-import the factory with mocked dependency
    const { processorFactory: mockedFactory } = await import(
      '@/libs/pixsaur-adapter'
    )

    const proc = await mockedFactory.createBestProcessor('gpu')
    // Can't use toBeInstanceOf because the mocked module import creates a different class reference
    // Instead, verify the processor has the expected interface and behavior
    expect(proc).toBeDefined()
    expect(proc.isAvailable).toBe(true)
    expect(typeof proc.renderRasterPreview).toBe('function')
    expect(typeof proc.dispose).toBe('function')

    // Even though type is 'regl', internal ReGL is undefined → CPU path
    const width = 1
    const height = 1
    const buffer = new Uint8Array([0])
    const palette = makePalette({ 0: [7, 8, 9] })
    const changes: RasterChange[] = []
    const img = proc.renderRasterPreview(
      buffer,
      width,
      height,
      palette,
      changes
    )
    const cpu = createRasterPreviewImageData(
      buffer,
      width,
      height,
      palette,
      changes
    )
    expect(Array.from(img.data)).toEqual(Array.from(cpu.data))
  })
})
