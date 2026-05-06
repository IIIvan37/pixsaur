import { getDefaultStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processorTypeAtom } from '@/app/store/config/config'
import { adapterLogger } from '@/core'
import { ReGLProcessor } from '@/libs/pixsaur-adapter/adapters/regl-processor'
import {
  disposeProcessorsAtom,
  imageProcessorAtom,
  initializeProcessorsAtom,
  processorFactory,
  processorTypeListenerAtom,
  reinitializeProcessorsAtom
} from '../processors'

vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    adapterLogger: {
      ...(actual.adapterLogger || {}),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
})

vi.mock('regl', () => ({
  default: vi.fn(() => ({
    destroy: vi.fn()
  }))
}))

vi.mock('@/libs/pixsaur-adapter/adapters/regl-processor', () => {
  const MockReGLProcessor = vi.fn(function (this: any, regl?: any) {
    this.type = regl ? 'regl' : 'cpu-fallback'
    this.isAvailable = true
    this.dispose = vi.fn()
    this.applyAdjustments = vi.fn()
    this.applyAdjustmentsSync = vi.fn((imageData) => imageData)
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
    store.set(imageProcessorAtom, null)
    store.set(processorTypeAtom, 'gpu')
  })

  afterEach(() => {
    store.set(disposeProcessorsAtom)
  })

  it('should initialize imageProcessorAtom as null', () => {
    expect(store.get(imageProcessorAtom)).toBeNull()
  })

  describe('Processor Factory', () => {
    it('should create CPU fallback processor when type is cpu', async () => {
      const processor = await processorFactory.createBestProcessor('cpu')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(undefined)
      expect(processor.type).toBe('cpu-fallback')
      expect(processor.isAvailable).toBe(true)
    })

    it('should create GPU processor when type is gpu', async () => {
      const processor = await processorFactory.createBestProcessor('gpu')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(expect.any(Object))
      expect(processor.type).toBe('regl')
    })

    it('should fallback to CPU in auto mode when ReGL creation fails', async () => {
      const mockRegl = vi.mocked(await import('regl')).default
      mockRegl.mockImplementationOnce(() => {
        throw new Error('WebGL not supported')
      })

      const processor = await processorFactory.createBestProcessor('auto')

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledWith(undefined)
      expect(processor.type).toBe('cpu-fallback')
      expect(vi.mocked(adapterLogger).warn).toHaveBeenCalled()
    })

    it('should throw in gpu mode when ReGL creation fails', async () => {
      const mockRegl = vi.mocked(await import('regl')).default
      mockRegl.mockImplementationOnce(() => {
        throw new Error('WebGL not supported')
      })

      await expect(processorFactory.createBestProcessor('gpu')).rejects.toThrow(
        'GPU processor requested but ReGL initialization failed'
      )
    })
  })

  describe('Initialize/Dispose lifecycle', () => {
    it('should initialize a single shared processor', async () => {
      await store.set(initializeProcessorsAtom)
      const processor = store.get(imageProcessorAtom)

      expect(processor).not.toBeNull()
      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Processor initialized: WebGL (GPU)'
      )
    })

    it('should be idempotent across multiple init calls', async () => {
      await store.set(initializeProcessorsAtom)
      await store.set(initializeProcessorsAtom)

      expect(vi.mocked(ReGLProcessor)).toHaveBeenCalledTimes(1)
    })

    it('should dispose processor and reset atom', async () => {
      await store.set(initializeProcessorsAtom)
      const processor = store.get(imageProcessorAtom)

      store.set(disposeProcessorsAtom)

      expect(store.get(imageProcessorAtom)).toBeNull()
      expect(processor?.dispose).toHaveBeenCalled()
    })

    it('should reinitialize on processor type change', async () => {
      await store.set(initializeProcessorsAtom)
      const oldProcessor = store.get(imageProcessorAtom)

      store.set(processorTypeAtom, 'cpu')
      await store.set(processorTypeListenerAtom, null)

      const newProcessor = store.get(imageProcessorAtom)
      expect(oldProcessor?.dispose).toHaveBeenCalled()
      expect(newProcessor).not.toBe(oldProcessor)
      expect(newProcessor?.type).toBe('cpu-fallback')
    })

    it('should reinitialize through reinitializeProcessorsAtom', async () => {
      await store.set(initializeProcessorsAtom)
      const oldProcessor = store.get(imageProcessorAtom)

      await store.set(reinitializeProcessorsAtom)

      const newProcessor = store.get(imageProcessorAtom)
      expect(oldProcessor?.dispose).toHaveBeenCalled()
      expect(newProcessor).not.toBe(oldProcessor)
    })
  })
})
