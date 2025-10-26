/**
 * Test simple pour valider la nouvelle architecture ReGL
 */

import { describe, expect, test } from 'vitest'
import { ReGLQuantizer } from '../adapters/regl-quantizer'

describe('ReGL Architecture Validation', () => {
  // Mock complet WebGL context
  const createMockWebGL = () => ({
    canvas: { width: 256, height: 256 },
    getExtension: () => null,
    getParameter: (param: any) => {
      // Simuler les constantes WebGL basiques
      if (param === 0x0d33) return 2048 // MAX_TEXTURE_SIZE
      return null
    },
    MAX_TEXTURE_SIZE: 0x0d33
  })

  test('ReGLQuantizer should exist and be constructible', () => {
    // Test simple : vérifier que la classe existe et peut être instanciée
    expect(ReGLQuantizer).toBeDefined()
    expect(typeof ReGLQuantizer).toBe('function')

    // Mock proper avec WebGL context
    const mockRegl = {
      _gl: createMockWebGL()
    } as any

    // Même sans GPU réel, la classe devrait pouvoir être créée
    expect(() => {
      const instance = new ReGLQuantizer(mockRegl)
      instance.dispose() // Nettoyer immédiatement
    }).not.toThrow()
  })

  test('ReGLQuantizer should have expected interface', () => {
    const mockRegl = {
      _gl: createMockWebGL()
    } as any

    const quantizer = new ReGLQuantizer(mockRegl)

    // Vérifier que les méthodes publiques existent
    expect(typeof quantizer.quantizePalette).toBe('function')
    expect(typeof quantizer.dispose).toBe('function')

    // Nettoyer
    quantizer.dispose()
  })
})
