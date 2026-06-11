import type { Vector } from '@/libs/pixsaur-color/src/type'
import { type OptimizeRasterInput, optimizeRaster } from './optimize-raster'

/** Gradient image — many unique colors per line, forces raster changes. */
function gradientImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      data[idx] = x * 32
      data[idx + 1] = y * 64
      data[idx + 2] = (x + y) * 20
      data[idx + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

/** A counting id generator stub. */
function fakeIdGenerator() {
  const gen = vi.fn(() => `id-${gen.mock.calls.length}`)
  return { generate: gen }
}

const PALETTE: Vector<'RGB'>[] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 0, 255]
]

function baseInput(
  overrides: Partial<OptimizeRasterInput> = {}
): OptimizeRasterInput {
  return {
    sourceImage: gradientImage(8, 4),
    exportPalette: PALETTE,
    modeConfig: { nColors: 4, height: 4 },
    hardware: 'plus',
    ditheringIntensity: 0,
    existingChanges: [],
    resetChanges: false,
    maxChangesPerLine: 4,
    ...overrides
  }
}

describe('optimizeRaster', () => {
  it('returns an optimization result sized to the source image', () => {
    const idGenerator = fakeIdGenerator()
    const result = optimizeRaster(baseInput(), { idGenerator })

    expect(result.optimizationResult.width).toBe(8)
    expect(result.optimizationResult.height).toBe(4)
    expect(result.optimizationResult.preprocessedImage.width).toBe(8)
    expect(result.optimizationResult.optimizedIndexBuffer).toBeInstanceOf(
      Uint8Array
    )
    expect(result.changesCount).toBe(result.changes.length)
    expect(result.linesAffected).toBe(
      new Set(result.changes.map((c) => c.line)).size
    )
  })

  it('mints a fresh id (via the port) for every new change', () => {
    const idGenerator = fakeIdGenerator()
    const result = optimizeRaster(baseInput(), { idGenerator })

    // No existing changes → every produced change gets a minted id.
    expect(result.changes.length).toBeGreaterThan(0)
    expect(idGenerator.generate).toHaveBeenCalledTimes(result.changes.length)
    for (const change of result.changes) {
      expect(typeof change.id).toBe('string')
      expect(change.id).toMatch(/^id-\d+$/)
    }
  })

  it('preserves the id of a change already present on the same (line, inkIndex)', () => {
    // First pass mints the ids.
    const first = optimizeRaster(baseInput(), {
      idGenerator: fakeIdGenerator()
    })
    expect(first.changes.length).toBeGreaterThan(0)

    // Second pass with resetChanges → the optimizer sees the same (empty) base,
    // so it produces the same (line, inkIndex) set. Every id must be reused
    // from the supplied existing changes; the generator is never called.
    const idGenerator = fakeIdGenerator()
    const second = optimizeRaster(
      baseInput({ existingChanges: first.changes, resetChanges: true }),
      { idGenerator }
    )

    expect(idGenerator.generate).not.toHaveBeenCalled()
    const firstIds = new Map(
      first.changes.map((c) => [`${c.line}-${c.inkIndex}`, c.id])
    )
    for (const change of second.changes) {
      expect(change.id).toBe(firstIds.get(`${change.line}-${change.inkIndex}`))
    }
  })

  it('drops changes beyond the mode height', () => {
    const result = optimizeRaster(
      baseInput({ modeConfig: { nColors: 4, height: 2 } }),
      { idGenerator: fakeIdGenerator() }
    )

    for (const change of result.changes) {
      expect(change.line).toBeLessThanOrEqual(1)
    }
  })

  it('ignores ignored-slot palette entries (color[0] === -1)', () => {
    const withIgnored: Vector<'RGB'>[] = [[-1, 0, 0], ...PALETTE]
    const result = optimizeRaster(baseInput({ exportPalette: withIgnored }), {
      idGenerator: fakeIdGenerator()
    })

    // The -1 sentinel must not leak into the quantized base palette.
    for (const color of result.optimizationResult.quantizedGlobalPalette) {
      expect(color[0]).not.toBe(-1)
    }
  })

  it('clamps max changes per line to the classic hardware limit', () => {
    // Classic hardware caps at 2 changes/line even if the user asks for more.
    const result = optimizeRaster(
      baseInput({ hardware: 'classic', maxChangesPerLine: 4 }),
      { idGenerator: fakeIdGenerator() }
    )

    const perLine = new Map<number, number>()
    for (const change of result.changes) {
      perLine.set(change.line, (perLine.get(change.line) ?? 0) + 1)
    }
    for (const count of perLine.values()) {
      expect(count).toBeLessThanOrEqual(2)
    }
  })
})
