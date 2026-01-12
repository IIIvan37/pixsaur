import { createStore } from 'jotai'
import { beforeEach, describe, expect, it } from 'vitest'
import { centerImageAtom, resizeModeAtom } from '../config/config'
import { rasterInputSignatureAtom } from './raster-signature'

describe('rasterInputSignatureAtom', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('resizeMode tracking', () => {
    it('should include resizeMode in signature', () => {
      const signature = store.get(rasterInputSignatureAtom)
      expect(signature).toHaveProperty('resizeMode')
    })

    it('should detect resizeMode change from auto to origin', () => {
      store.set(resizeModeAtom, 'auto')
      const signatureBefore = store.get(rasterInputSignatureAtom)

      store.set(resizeModeAtom, 'origin')
      const signatureAfter = store.get(rasterInputSignatureAtom)

      expect(signatureBefore.resizeMode).toBe('auto')
      expect(signatureAfter.resizeMode).toBe('origin')
      expect(signatureBefore.resizeMode).not.toBe(signatureAfter.resizeMode)
    })

    it('should detect resizeMode change from origin to auto', () => {
      store.set(resizeModeAtom, 'origin')
      const signatureBefore = store.get(rasterInputSignatureAtom)

      store.set(resizeModeAtom, 'auto')
      const signatureAfter = store.get(rasterInputSignatureAtom)

      expect(signatureBefore.resizeMode).toBe('origin')
      expect(signatureAfter.resizeMode).toBe('auto')
    })
  })

  describe('centerImage tracking', () => {
    it('should include centerImage in signature', () => {
      const signature = store.get(rasterInputSignatureAtom)
      expect(signature).toHaveProperty('centerImage')
    })

    it('should detect centerImage change', () => {
      store.set(centerImageAtom, true)
      const signatureBefore = store.get(rasterInputSignatureAtom)

      store.set(centerImageAtom, false)
      const signatureAfter = store.get(rasterInputSignatureAtom)

      expect(signatureBefore.centerImage).toBe(true)
      expect(signatureAfter.centerImage).toBe(false)
    })
  })

  describe('regression tests for raster invalidation', () => {
    it('should have different signatures when resizeMode changes (fixes raster not updating on mode switch)', () => {
      // This test ensures that when switching between auto and origin mode,
      // the raster signature changes, which triggers raster invalidation
      store.set(resizeModeAtom, 'auto')
      const autoSignature = JSON.stringify(store.get(rasterInputSignatureAtom))

      store.set(resizeModeAtom, 'origin')
      const originSignature = JSON.stringify(
        store.get(rasterInputSignatureAtom)
      )

      expect(autoSignature).not.toBe(originSignature)
    })

    it('should have different signatures when centerImage changes', () => {
      store.set(centerImageAtom, true)
      const centeredSignature = JSON.stringify(
        store.get(rasterInputSignatureAtom)
      )

      store.set(centerImageAtom, false)
      const notCenteredSignature = JSON.stringify(
        store.get(rasterInputSignatureAtom)
      )

      expect(centeredSignature).not.toBe(notCenteredSignature)
    })
  })
})
