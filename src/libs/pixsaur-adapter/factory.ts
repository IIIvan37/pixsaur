/**
 * `processorFactory` — the single place that answers "GPU or CPU?".
 *
 * Both implementations (`GpuProcessor`, `CpuProcessor`) are constructed here
 * and nowhere else, so neither of them carries a fallback branch. This module
 * is independent of the Jotai store; it only depends on the lib and `regl`.
 */

import type REGL from 'regl'
import createREGL from 'regl'
import { adapterLogger } from '@/core'
import { CpuProcessor } from './adapters/cpu-processor'
import { GpuProcessor } from './adapters/gpu-processor'
import type {
  ImageProcessor,
  ProcessorFactory,
  ProcessorType
} from './interfaces'

/**
 * Creates the `regl` instance the GPU processor needs. Returns `undefined`
 * when WebGL is unavailable — the only capability probe there is, since a
 * successful `createREGL()` is proof by construction.
 */
function createGpuInstance(): REGL.Regl | undefined {
  try {
    return createREGL({
      extensions: [],
      optionalExtensions: ['OES_texture_float', 'OES_texture_half_float'],
      attributes: {
        preserveDrawingBuffer: false,
        antialias: false,
        depth: false,
        stencil: false
      }
    })
  } catch (error) {
    adapterLogger.warn('[FACTORY] Failed to create ReGL instance:', error)
    return undefined
  }
}

export const processorFactory: ProcessorFactory = {
  async createBestProcessor(
    type: ProcessorType = 'gpu'
  ): Promise<ImageProcessor> {
    if (type === 'cpu') {
      return new CpuProcessor()
    }

    const regl = createGpuInstance()
    if (!regl) {
      if (type === 'gpu') {
        throw new Error(
          'GPU processor requested but ReGL initialization failed'
        )
      }
      adapterLogger.warn(
        '[FACTORY] Auto mode fallback: ReGL unavailable, using CPU processor'
      )
      return new CpuProcessor()
    }

    try {
      return new GpuProcessor(regl)
    } catch (error) {
      // WebGL is there but the pipeline would not build (shader compilation,
      // quantizer setup). Degrade rather than leave the app without a
      // processor; the store surfaces the fallback as a toast.
      adapterLogger.warn(
        '[FACTORY] GPU pipeline setup failed, using CPU processor',
        error
      )
      regl.destroy()
      return new CpuProcessor()
    }
  }
}
