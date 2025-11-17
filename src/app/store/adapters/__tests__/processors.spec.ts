import { getDefaultStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processorTypeAtom } from '@/app/store/config/config'
import { ReGLProcessor } from '@/libs/pixsaur-adapter/adapters/regl-processor'
import { adapterLogger } from '@/utils/core'
import {
  disposeProcessorsAtom,
  imageProcessorAtom,
  initializeProcessorsAtom,
  paletteProcessorAtom,
  processorFactory,
  processorTypeListenerAtom,
  reinitializeProcessorsAtom
} from '../processors'

// Mock the logger
vi.mock('@/utils/core', () => ({
  adapterLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock ReGL
vi.mock('regl', () => ({
  default: vi.fn(() => ({
    destroy: vi.fn()
  }))
}))

// Mock ReGLProcessor
vi.mock('@/libs/pixsaur-adapter/adapters/regl-processor', () => {
  const MockReGLProcessor = vi.fn(function (this: any, regl?: any) {
    this.type = regl ? 'regl' : 'cpu'
    this.isAvailable = true
    this.dispose = vi.fn()
    this.applyAdjustments = vi.fn()
    this.applyAdjustmentsSync = vi.fn()
    this.quantizePalette = vi.fn()
    return this
  })

  return {
    ReGLProcessor: MockReGLProcessor
  }
})

describe('Processor Store Adapters', () => {
  let store: ReturnType<typeof getDefaultStore>

  beforeEach(() => {
    store = getDefaultStore()
    vi.clearAllMocks()

    // Reset atoms to initial state
    store.set(imageProcessorAtom, null)
    store.set(paletteProcessorAtom, null)
    store.set(processorTypeAtom, 'gpu')
  })

  afterEach(() => {
    // Clean up any processors that might have been created
    store.set(disposeProcessorsAtom)
  })

  describe('Initial State', () => {
    it('should initialize imageProcessorAtom as null', () => {
      expect(store.get(imageProcessorAtom)).toBeNull()
    })

    it('should initialize paletteProcessorAtom as null', () => {
      expect(store.get(paletteProcessorAtom)).toBeNull()
    })
  })

  describe('Processor Factory', () => {
    it('should create CPU processor when type is cpu', async () => {
      const processor = await processorFactory.createBestProcessor('cpu')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(undefined)
      expect(processor.type).toBe('cpu')
      expect(processor.isAvailable).toBe(true)
    })

    it('should create GPU processor when type is gpu', async () => {
      const processor = await processorFactory.createBestProcessor('gpu')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(expect.any(Object))
      expect(processor.type).toBe('regl')
      expect(processor.isAvailable).toBe(true)
    })

    it('should create GPU processor by default', async () => {
      const processor = await processorFactory.createBestProcessor()

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(expect.any(Object))
      expect(processor.type).toBe('regl')
    })

    it('should fallback to CPU when ReGL creation fails', async () => {
      // Mock ReGL to throw
      const mockRegl = vi.mocked(await import('regl')).default
      mockRegl.mockImplementationOnce(() => {
        throw new Error('WebGL not supported')
      })

      const processor = await processorFactory.createBestProcessor('gpu')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(undefined)
      expect(processor.type).toBe('cpu')
    })
  })

  describe('Initialize Processors Atom', () => {
    it('should initialize both image and palette processors', async () => {
      await store.set(initializeProcessorsAtom)

      const imageProcessor = store.get(imageProcessorAtom)
      const paletteProcessor = store.get(paletteProcessorAtom)

      expect(imageProcessor).not.toBeNull()
      expect(paletteProcessor).not.toBeNull()
      expect(imageProcessor?.type).toBe('regl')
      expect(paletteProcessor?.type).toBe('regl')
    })

    it('should respect processor type from config', async () => {
      store.set(processorTypeAtom, 'cpu')

      await store.set(initializeProcessorsAtom)

      const imageProcessor = store.get(imageProcessorAtom)
      expect(imageProcessor?.type).toBe('cpu')
    })

    it('should be idempotent - multiple calls should not recreate processors', async () => {
      await store.set(initializeProcessorsAtom)
      await store.set(initializeProcessorsAtom)

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledTimes(2) // Once for each processor
    })

    it('should handle concurrent initialization calls', async () => {
      const promises = [
        store.set(initializeProcessorsAtom),
        store.set(initializeProcessorsAtom),
        store.set(initializeProcessorsAtom)
      ]

      await Promise.all(promises)

      const imageProcessor = store.get(imageProcessorAtom)
      const paletteProcessor = store.get(paletteProcessorAtom)

      expect(imageProcessor).not.toBeNull()
      expect(paletteProcessor).not.toBeNull()
    })

    it('should throw error when processor creation fails', async () => {
      vi.mocked(ReGLProcessor).mockImplementationOnce(() => {
        throw new Error('Processor creation failed')
      })

      await expect(store.set(initializeProcessorsAtom)).rejects.toThrow(
        'Processor creation failed'
      )
    })

    it('should log processor types', async () => {
      await store.set(initializeProcessorsAtom)

      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Image processor: WebGL (GPU)'
      )
      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Palette processor: WebGL (GPU)'
      )
    })

    it('should log CPU fallback', async () => {
      store.set(processorTypeAtom, 'cpu')

      await store.set(initializeProcessorsAtom)

      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Image processor: CPU'
      )
      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Palette processor: CPU'
      )
    })
  })

  describe('Dispose Processors Atom', () => {
    it('should dispose both processors and set atoms to null', async () => {
      await store.set(initializeProcessorsAtom)

      const imageProcessor = store.get(imageProcessorAtom)
      const paletteProcessor = store.get(paletteProcessorAtom)

      expect(imageProcessor).not.toBeNull()
      expect(paletteProcessor).not.toBeNull()

      store.set(disposeProcessorsAtom)

      expect(store.get(imageProcessorAtom)).toBeNull()
      expect(store.get(paletteProcessorAtom)).toBeNull()
      expect(imageProcessor?.dispose).toHaveBeenCalled()
      expect(paletteProcessor?.dispose).toHaveBeenCalled()
    })

    it('should handle disposal when processors are already null', () => {
      expect(() => store.set(disposeProcessorsAtom)).not.toThrow()
    })

    it('should dispose only image processor when palette processor is null', async () => {
      await store.set(initializeProcessorsAtom)
      store.set(paletteProcessorAtom, null)

      const imageProcessor = store.get(imageProcessorAtom)

      store.set(disposeProcessorsAtom)

      expect(imageProcessor?.dispose).toHaveBeenCalled()
      expect(store.get(imageProcessorAtom)).toBeNull()
      expect(store.get(paletteProcessorAtom)).toBeNull()
    })
  })

  describe('Reinitialize Processors Atom', () => {
    it('should dispose existing processors and create new ones', async () => {
      await store.set(initializeProcessorsAtom)

      const oldImageProcessor = store.get(imageProcessorAtom)
      const oldPaletteProcessor = store.get(paletteProcessorAtom)

      await store.set(reinitializeProcessorsAtom)

      const newImageProcessor = store.get(imageProcessorAtom)
      const newPaletteProcessor = store.get(paletteProcessorAtom)

      expect(oldImageProcessor?.dispose).toHaveBeenCalled()
      expect(oldPaletteProcessor?.dispose).toHaveBeenCalled()
      expect(newImageProcessor).not.toBe(oldImageProcessor)
      expect(newPaletteProcessor).not.toBe(oldPaletteProcessor)
    })

    it('should handle reinitialization when no processors exist', async () => {
      await store.set(reinitializeProcessorsAtom)

      const imageProcessor = store.get(imageProcessorAtom)
      const paletteProcessor = store.get(paletteProcessorAtom)

      expect(imageProcessor).not.toBeNull()
      expect(paletteProcessor).not.toBeNull()
    })
  })

  describe('Processor Type Listener Atom', () => {
    it('should reinitialize processors when processor type changes', async () => {
      await store.set(initializeProcessorsAtom)

      const oldImageProcessor = store.get(imageProcessorAtom)

      // Change processor type and trigger reinitialization
      store.set(processorTypeAtom, 'cpu')
      await store.set(processorTypeListenerAtom, null)

      const newImageProcessor = store.get(imageProcessorAtom)
      expect(newImageProcessor?.type).toBe('cpu')
      expect(oldImageProcessor?.dispose).toHaveBeenCalled()
    })

    it('should handle multiple type changes', async () => {
      await store.set(initializeProcessorsAtom)

      store.set(processorTypeAtom, 'cpu')
      await store.set(processorTypeListenerAtom, null)
      expect(store.get(imageProcessorAtom)?.type).toBe('cpu')

      store.set(processorTypeAtom, 'gpu')
      await store.set(processorTypeListenerAtom, null)
      expect(store.get(imageProcessorAtom)?.type).toBe('regl')
    })
  })

  describe('Error Handling', () => {
    it('should log errors during initialization', async () => {
      vi.mocked(ReGLProcessor).mockImplementationOnce(() => {
        throw new Error('Initialization error')
      })

      await expect(store.set(initializeProcessorsAtom)).rejects.toThrow()

      expect(vi.mocked(adapterLogger).error).toHaveBeenCalledWith(
        'Failed to initialize processors:',
        expect.any(Error)
      )
    })

    it('should reset initialization state after error', async () => {
      vi.mocked(ReGLProcessor).mockImplementationOnce(() => {
        throw new Error('Initialization error')
      })

      await expect(store.set(initializeProcessorsAtom)).rejects.toThrow()

      // Should be able to try again - reset to normal constructor
      vi.mocked(ReGLProcessor).mockImplementation(function (
        this: any,
        regl?: any
      ) {
        this.type = regl ? 'regl' : 'cpu'
        this.isAvailable = true
        this.dispose = vi.fn()
        this.applyAdjustments = vi.fn()
        this.applyAdjustmentsSync = vi.fn()
        this.quantizePalette = vi.fn()
        return this
      })

      await store.set(initializeProcessorsAtom)

      expect(store.get(imageProcessorAtom)).not.toBeNull()
      expect(store.get(paletteProcessorAtom)).not.toBeNull()
    })
  })
})
