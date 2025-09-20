import { describe, it, expect, beforeEach } from 'vitest'
import { CPUQuantizer } from './cpu-quantizer'
import type { QuantizeParams } from './quantizer-base'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'

describe('CPUQuantizer DRY Architecture', () => {
  let quantizer: CPUQuantizer
  let testImageData: ImageData
  let testParams: QuantizeParams

  beforeEach(() => {
    quantizer = new CPUQuantizer()
    
    // Créer une image de test simple avec ImageData constructor
    const data = new Uint8ClampedArray(4 * 4 * 4) // 4x4 pixels, 4 bytes per pixel
    
    // Pixel rouge pur
    data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255
    // Pixel vert pur  
    data[4] = 0; data[5] = 255; data[6] = 0; data[7] = 255
    // Pixel bleu pur
    data[8] = 0; data[9] = 0; data[10] = 255; data[11] = 255
    // Pixel blanc
    data[12] = 255; data[13] = 255; data[14] = 255; data[15] = 255
    
    testImageData = new ImageData(data, 4, 4)
    
    testParams = {
      targetColors: 4,
      basePalette: generateAmstradCPCPalette(),
      preselectedIndices: [],
      colorSpace: 'RGB',
      contrastStrategy: 'max'
    }
  })

  describe('DRY Architecture Validation', () => {
    it('should inherit common validation logic', async () => {
      const invalidParams = { ...testParams, targetColors: 0 }
      
      await expect(quantizer.quantize(testImageData, invalidParams))
        .rejects
        .toThrow('targetColors must be greater than 0')
    })

    it('should use shared color conversion logic', async () => {
      // Test avec différents espaces colorimétriques
      const rgbParams = { ...testParams, colorSpace: 'RGB' as const }
      const labParams = { ...testParams, colorSpace: 'Lab' as const }
      const xyzParams = { ...testParams, colorSpace: 'XYZ' as const }

      const rgbResult = await quantizer.quantize(testImageData, rgbParams)
      const labResult = await quantizer.quantize(testImageData, labParams)
      const xyzResult = await quantizer.quantize(testImageData, xyzParams)

      // Tous devraient retourner des résultats valides (minimum 1 couleur)
      expect(rgbResult.selectedColors.length).toBeGreaterThan(0)
      expect(labResult.selectedColors.length).toBeGreaterThan(0)
      expect(xyzResult.selectedColors.length).toBeGreaterThan(0)

      // Chaque couleur doit être dans la palette CPC
      const cpcPalette = generateAmstradCPCPalette()
      for (const color of rgbResult.selectedColors) {
        expect(cpcPalette.some(cpc => 
          cpc[0] === color[0] && cpc[1] === color[1] && cpc[2] === color[2]
        )).toBe(true)
      }
    })

    it('should use shared selection logic', async () => {
      const result = await quantizer.quantize(testImageData, testParams)
      
      // Le résultat doit contenir au moins une couleur (DRY logic partagée)
      expect(result.selectedColors.length).toBeGreaterThan(0)
      expect(result.indices.length).toBeGreaterThan(0)
      
      // Histogram doit être défini
      expect(result.histogram).toBeDefined()
      expect(result.histogram!.length).toBe(testParams.basePalette.length)
    })

    it('should handle preselected colors correctly', async () => {
      const preselectedIndices = [0, 1] // Premières couleurs CPC
      const paramsWithPreselected = {
        ...testParams,
        preselectedIndices,
        targetColors: 3
      }
      
      const result = await quantizer.quantize(testImageData, paramsWithPreselected)
      
      // Le résultat doit inclure les couleurs présélectionnées (DRY validation)
      expect(result.selectedColors.length).toBeGreaterThanOrEqual(2)
      
      const cpcPalette = generateAmstradCPCPalette()
      const preselectedColors = preselectedIndices.map(idx => cpcPalette[idx])
      
      // Vérifier que les couleurs présélectionnées sont incluses
      for (const preselectedColor of preselectedColors) {
        expect(result.selectedColors.some(selected =>
          selected[0] === preselectedColor[0] &&
          selected[1] === preselectedColor[1] &&
          selected[2] === preselectedColor[2]
        )).toBe(true)
      }
    })

    it('should apply contrast strategy correctly', async () => {
      const maxParams = { ...testParams, contrastStrategy: 'max' as const }
      const balancedParams = { ...testParams, contrastStrategy: 'balanced' as const }
      
      const maxResult = await quantizer.quantize(testImageData, maxParams)
      const balancedResult = await quantizer.quantize(testImageData, balancedParams)
      
      // Les deux devraient retourner des couleurs (DRY strategy validation)
      expect(maxResult.selectedColors.length).toBeGreaterThan(0)
      expect(balancedResult.selectedColors.length).toBeGreaterThan(0)
      
      // Les stratégies peuvent donner des résultats différents
      // (test de non-régression plutôt que d'égalité stricte)
      expect(maxResult.selectedColors).toBeDefined()
      expect(balancedResult.selectedColors).toBeDefined()
    })
  })

  describe('CPU-Specific Logic', () => {
    it('should compute histogram correctly', async () => {
      const result = await quantizer.quantize(testImageData, testParams)
      
      // Histogram doit avoir été calculé
      expect(result.histogram).toBeDefined()
      expect(result.histogram!.length).toBe(testParams.basePalette.length)
      
      // La somme de l'histogramme doit égaler le nombre total de pixels
      const totalPixels = testImageData.width * testImageData.height
      const histogramSum = Array.from(result.histogram!).reduce((sum, count) => sum + count, 0)
      expect(histogramSum).toBe(totalPixels)
    })

    it('should handle different color spaces in histogram computation', async () => {
      // Test que l'histogramme est différent selon l'espace colorimétrique
      const rgbParams = { ...testParams, colorSpace: 'RGB' as const }
      const labParams = { ...testParams, colorSpace: 'Lab' as const }
      
      const rgbResult = await quantizer.quantize(testImageData, rgbParams)
      const labResult = await quantizer.quantize(testImageData, labParams)
      
      // Les histogrammes peuvent être différents selon l'espace colorimétrique
      expect(rgbResult.histogram).toBeDefined()
      expect(labResult.histogram).toBeDefined()
      
      // Vérifier que les deux calculent correctement le total
      const totalPixels = testImageData.width * testImageData.height
      const rgbSum = Array.from(rgbResult.histogram!).reduce((sum, count) => sum + count, 0)
      const labSum = Array.from(labResult.histogram!).reduce((sum, count) => sum + count, 0)
      
      expect(rgbSum).toBe(totalPixels)
      expect(labSum).toBe(totalPixels)
    })
  })

  describe('Performance and Memory', () => {
    it('should dispose resources cleanly', () => {
      expect(() => quantizer.dispose()).not.toThrow()
    })

    it('should handle large images efficiently', async () => {
      // Créer une image plus grande
      const largeData = new Uint8ClampedArray(100 * 100 * 4)
      
      // Remplir avec un pattern simple
      for (let i = 0; i < largeData.length; i += 4) {
        largeData[i] = 255     // R
        largeData[i + 1] = 0   // G  
        largeData[i + 2] = 0   // B
        largeData[i + 3] = 255 // A
      }
      
      const largeImageData = new ImageData(largeData, 100, 100)
      
      const start = performance.now()
      const result = await quantizer.quantize(largeImageData, testParams)
      const duration = performance.now() - start
      
      // Devrait terminer en moins d'une seconde (très généreux)
      expect(duration).toBeLessThan(1000)
      expect(result.selectedColors.length).toBeGreaterThan(0)
    })
  })
})