/**
 * ProcessorFactory — crée le meilleur ReGLProcessor disponible selon le type demandé.
 * Ce module est indépendant du store Jotai ; il n'importe que le lib et regl.
 */

import type REGL from 'regl'
import createREGL from 'regl'
import { adapterLogger } from '@/core'
import type { ProcessorType } from './interfaces'
import { ReGLProcessor } from './adapters/regl-processor'

export const processorFactory = {
  async createBestProcessor(type: ProcessorType | string = 'gpu') {
    if (type === 'cpu') {
      return new ReGLProcessor(undefined)
    }

    if (type === 'gpu') {
      const reglInstance = this.createGpuInstance()
      if (!reglInstance) {
        throw new Error('GPU processor requested but ReGL initialization failed')
      }
      return new ReGLProcessor(reglInstance)
    }

    // auto: tenter GPU puis fallback silencieux CPU
    const reglInstance = this.createGpuInstance()
    if (!reglInstance) {
      adapterLogger.warn(
        '[FACTORY] Auto mode fallback: ReGL unavailable, using CPU processor'
      )
      return new ReGLProcessor(undefined)
    }

    return new ReGLProcessor(reglInstance)
  },

  createGpuInstance(): REGL.Regl | undefined {
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
}
