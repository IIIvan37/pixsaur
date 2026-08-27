import { getDefaultStore } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processorTypeAtom } from '@/app/store/config/config'
import { adapterLogger } from '@/core'
import { CpuProcessor } from '@/libs/pixsaur-adapter/adapters/cpu-processor'
import { GpuProcessor } from '@/libs/pixsaur-adapter/adapters/gpu-processor'
import { processorFactory } from '@/libs/pixsaur-adapter/factory'
import {
  disposeProcessorsAtom,
  imageProcessorAtom,
  initializeProcessorsAtom,
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

function mockProcessor(type: 'cpu' | 'gpu') {
  return vi.fn(function (this: any) {
    this.type = type
    this.dispose = vi.fn()
    this.applyAdjustments = vi.fn((imageData) => imageData)
    this.quantizePalette = vi.fn()
    this.renderRasterPreview = vi.fn()
    return this
  })
}

vi.mock('@/libs/pixsaur-adapter/adapters/cpu-processor', () => ({
  CpuProcessor: mockProcessor('cpu')
}))

vi.mock('@/libs/pixsaur-adapter/adapters/gpu-processor', () => ({
  GpuProcessor: mockProcessor('gpu')
}))

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
    it('should create a CPU processor when type is cpu', async () => {
      const processor = await processorFactory.createBestProcessor('cpu')

      expect(vi.mocked(CpuProcessor)).toHaveBeenCalledTimes(1)
      expect(processor.type).toBe('cpu')
    })

    it('should not touch WebGL at all when type is cpu', async () => {
      const mockRegl = vi.mocked(await import('regl')).default
      await processorFactory.createBestProcessor('cpu')

      expect(mockRegl).not.toHaveBeenCalled()
    })

    it('should create a GPU processor when type is gpu', async () => {
      const processor = await processorFactory.createBestProcessor('gpu')

      expect(vi.mocked(GpuProcessor)).toHaveBeenCalledWith(expect.any(Object))
      expect(processor.type).toBe('gpu')
    })

    it('should fallback to CPU in auto mode when ReGL creation fails', async () => {
      const mockRegl = vi.mocked(await import('regl')).default
      mockRegl.mockImplementationOnce(() => {
        throw new Error('WebGL not supported')
      })

      const processor = await processorFactory.createBestProcessor('auto')

      expect(processor.type).toBe('cpu')
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

    it('should fallback to CPU when WebGL is there but the pipeline will not build', async () => {
      vi.mocked(GpuProcessor).mockImplementationOnce(() => {
        throw new Error('shader compilation failed')
      })

      const processor = await processorFactory.createBestProcessor('gpu')

      expect(processor.type).toBe('cpu')
    })

    it('should release the regl instance when the GPU pipeline will not build', async () => {
      const reglInstance = { destroy: vi.fn() }
      vi.mocked(await import('regl')).default.mockReturnValueOnce(
        reglInstance as any
      )
      vi.mocked(GpuProcessor).mockImplementationOnce(() => {
        throw new Error('shader compilation failed')
      })

      await processorFactory.createBestProcessor('gpu')

      expect(reglInstance.destroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Initialize/Dispose lifecycle', () => {
    it('should initialize a single shared processor', async () => {
      await store.set(initializeProcessorsAtom)
      const processor = store.get(imageProcessorAtom)

      expect(processor).not.toBeNull()
      expect(vi.mocked(GpuProcessor)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(adapterLogger).info).toHaveBeenCalledWith(
        'Processor initialized: WebGL (GPU)'
      )
    })

    it('should be idempotent across multiple init calls', async () => {
      await store.set(initializeProcessorsAtom)
      await store.set(initializeProcessorsAtom)

      expect(vi.mocked(GpuProcessor)).toHaveBeenCalledTimes(1)
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
      expect(newProcessor?.type).toBe('cpu')
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
