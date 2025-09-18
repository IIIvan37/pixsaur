import { beforeEach, describe, it } from 'vitest'
import { processorFactory } from '@/libs/pixsaur-adapter'
import { generateAmstradCPCPalette } from '@/palettes/cpc-palette'
import { remapImageDataToPalette } from '@/utils/exports/rgb-to-indexes'
import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Test de comparaison visuelle entre CPU et ReGL
 * 
 * Ce test génère des images comparatives pour analyser visuellement
 * les différences de rendu entre CPU et ReGL.
 */
describe('Visual Comparison Tests', () => {
  let testImageData: ImageData
  let testBuffer: Uint8ClampedArray
  let basePalette: Vector[]

  beforeEach(() => {
    // Créer une image de test plus complexe
    const width = 128
    const height = 128
    const data = new Uint8ClampedArray(width * height * 4)
    
    // Créer une image avec des patterns variés pour tester la quantification
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4
        
        // Pattern complexe avec gradients et zones de couleurs
        if (x < width / 4) {
          // Zone rouge avec gradient
          data[index] = Math.floor((y / height) * 255)
          data[index + 1] = 50
          data[index + 2] = 50
        } else if (x < width / 2) {
          // Zone verte avec pattern
          data[index] = 50
          data[index + 1] = Math.floor(Math.sin(x * 0.1) * 127 + 128)
          data[index + 2] = Math.floor((1 - y / height) * 255)
        } else if (x < 3 * width / 4) {
          // Zone bleue avec damier
          const checker = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 100
          data[index] = checker
          data[index + 1] = checker
          data[index + 2] = 200 + Math.floor((x / width) * 55)
        } else {
          // Zone mixte avec couleurs variées
          data[index] = Math.floor((x + y) / (width + height) * 255)
          data[index + 1] = Math.floor(Math.cos(y * 0.1) * 127 + 128)
          data[index + 2] = Math.floor(((width - x) * y) / (width * height) * 255)
        }
        
        data[index + 3] = 255 // Alpha
      }
    }
    
    testImageData = new ImageData(data, width, height)
    testBuffer = new Uint8ClampedArray(testImageData.data)
    basePalette = generateAmstradCPCPalette()
  })

  describe('Full Pipeline Comparison', () => {
    it('should generate comparison images for CPU vs ReGL pipeline', async () => {
      console.log('🖼️ Generating visual comparison images...')
      
      const targetColors = 16 // Mode CPC 0
      const colorSpace = 'RGB'
      
      try {
        // Traitement complet avec CPU
        console.log('🖥️ Processing with CPU...')
        const cpuProcessor = await processorFactory.createBestProcessor('cpu')
        const cpuPalette = await cpuProcessor.quantizePalette(
          testBuffer,
          testImageData,
          targetColors,
          basePalette,
          [],
          colorSpace
        )
        
        // Traitement complet avec ReGL
        console.log('🎮 Processing with ReGL...')
        const reglProcessor = await processorFactory.createBestProcessor('gpu')
        const reglPalette = await reglProcessor.quantizePalette(
          testBuffer,
          testImageData,
          targetColors,
          basePalette,
          [],
          colorSpace
        )
        
        // Remapper l'image avec chaque palette
        const cpuRemapped = remapImageDataToPalette(testImageData, cpuPalette)
        const reglRemapped = remapImageDataToPalette(testImageData, reglPalette)
        
        // Analyse des différences pixel par pixel
        const pixelDifferences: number[] = []
        const totalPixels = testImageData.width * testImageData.height
        
        for (let i = 0; i < totalPixels * 4; i += 4) {
          const cpuR = cpuRemapped.data[i]
          const cpuG = cpuRemapped.data[i + 1]
          const cpuB = cpuRemapped.data[i + 2]
          
          const reglR = reglRemapped.data[i]
          const reglG = reglRemapped.data[i + 1]
          const reglB = reglRemapped.data[i + 2]
          
          const pixelDiff = Math.abs(cpuR - reglR) + Math.abs(cpuG - reglG) + Math.abs(cpuB - reglB)
          pixelDifferences.push(pixelDiff)
        }
        
        // Statistiques des différences
        const avgPixelDiff = pixelDifferences.reduce((sum, diff) => sum + diff, 0) / pixelDifferences.length
        const maxPixelDiff = Math.max(...pixelDifferences)
        const differentPixels = pixelDifferences.filter(diff => diff > 0).length
        const differentPixelPercentage = (differentPixels / totalPixels) * 100
        
        console.log('📊 Visual Comparison Results:')
        console.log(`  Original image: ${testImageData.width}x${testImageData.height}`)
        console.log(`  CPU palette colors: ${cpuPalette.length}`)
        console.log(`  ReGL palette colors: ${reglPalette.length}`)
        console.log(`  Average pixel difference: ${avgPixelDiff.toFixed(2)}`)
        console.log(`  Maximum pixel difference: ${maxPixelDiff}`)
        console.log(`  Different pixels: ${differentPixels}/${totalPixels} (${differentPixelPercentage.toFixed(1)}%)`)
        
        // Analyse des palettes
        console.log('\\n🎨 Palette Analysis:')
        
        console.log('CPU Palette:')
        cpuPalette.forEach((color, i) => {
          const r = Math.round(color[0] * 255)
          const g = Math.round(color[1] * 255)
          const b = Math.round(color[2] * 255)
          console.log(`  Color ${i}: RGB(${r}, ${g}, ${b}) - #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`)
        })
        
        console.log('\\nReGL Palette:')
        reglPalette.forEach((color, i) => {
          const r = Math.round(color[0] * 255)
          const g = Math.round(color[1] * 255)
          const b = Math.round(color[2] * 255)
          console.log(`  Color ${i}: RGB(${r}, ${g}, ${b}) - #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`)
        })
        
        // Si possible, sauvegarder les images pour comparaison visuelle
        if (typeof document !== 'undefined') {
          console.log('\\n💾 Saving comparison images...')
          
          const originalCanvas = document.createElement('canvas')
          originalCanvas.width = testImageData.width
          originalCanvas.height = testImageData.height
          const originalCtx = originalCanvas.getContext('2d')!
          originalCtx.putImageData(testImageData, 0, 0)
          
          const cpuCanvas = document.createElement('canvas')
          cpuCanvas.width = testImageData.width
          cpuCanvas.height = testImageData.height
          const cpuCtx = cpuCanvas.getContext('2d')!
          cpuCtx.putImageData(cpuRemapped, 0, 0)
          
          const reglCanvas = document.createElement('canvas')
          reglCanvas.width = testImageData.width
          reglCanvas.height = testImageData.height
          const reglCtx = reglCanvas.getContext('2d')!
          reglCtx.putImageData(reglRemapped, 0, 0)
          
          console.log('Original image data URL:', originalCanvas.toDataURL().substring(0, 100) + '...')
          console.log('CPU processed data URL:', cpuCanvas.toDataURL().substring(0, 100) + '...')
          console.log('ReGL processed data URL:', reglCanvas.toDataURL().substring(0, 100) + '...')
        }
        
      } catch (error) {
        console.error('❌ Visual comparison test failed:', error)
        throw error
      }
    })
  })

  describe('Palette Color Distribution Analysis', () => {
    it('should analyze color distribution differences', async () => {
      console.log('📈 Analyzing color distribution differences...')
      
      try {
        const cpuProcessor = await processorFactory.createBestProcessor('cpu')
        const reglProcessor = await processorFactory.createBestProcessor('gpu')
        
        const cpuPalette = await cpuProcessor.quantizePalette(testBuffer, testImageData, 8, basePalette, [], 'RGB')
        const reglPalette = await reglProcessor.quantizePalette(testBuffer, testImageData, 8, basePalette, [], 'RGB')
        
        // Analyser la distribution des couleurs dans chaque palette
        const analyzePalette = (palette: Vector[], name: string) => {
          console.log(`\\n${name} Palette Analysis:`)
          
          const hues: number[] = []
          const saturations: number[] = []
          const lightnesses: number[] = []
          
          palette.forEach(color => {
            const r = color[0]
            const g = color[1]
            const b = color[2]
            
            // Conversion RGB vers HSL approximative
            const max = Math.max(r, g, b)
            const min = Math.min(r, g, b)
            const lightness = (max + min) / 2
            const saturation = lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
            
            let hue = 0
            if (max !== min) {
              switch (max) {
                case r: hue = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6; break
                case g: hue = ((b - r) / (max - min) + 2) / 6; break
                case b: hue = ((r - g) / (max - min) + 4) / 6; break
              }
            }
            
            hues.push(hue * 360)
            saturations.push(saturation)
            lightnesses.push(lightness)
          })
          
          const avgHue = hues.reduce((sum, h) => sum + h, 0) / hues.length
          const avgSaturation = saturations.reduce((sum, s) => sum + s, 0) / saturations.length
          const avgLightness = lightnesses.reduce((sum, l) => sum + l, 0) / lightnesses.length
          
          console.log(`  Average Hue: ${avgHue.toFixed(1)}°`)
          console.log(`  Average Saturation: ${(avgSaturation * 100).toFixed(1)}%`)
          console.log(`  Average Lightness: ${(avgLightness * 100).toFixed(1)}%`)
          
          return { avgHue, avgSaturation, avgLightness }
        }
        
        const cpuStats = analyzePalette(cpuPalette, 'CPU')
        const reglStats = analyzePalette(reglPalette, 'ReGL')
        
        console.log('\\n🔍 Distribution Differences:')
        console.log(`  Hue difference: ${Math.abs(cpuStats.avgHue - reglStats.avgHue).toFixed(1)}°`)
        console.log(`  Saturation difference: ${(Math.abs(cpuStats.avgSaturation - reglStats.avgSaturation) * 100).toFixed(1)}%`)
        console.log(`  Lightness difference: ${(Math.abs(cpuStats.avgLightness - reglStats.avgLightness) * 100).toFixed(1)}%`)
        
      } catch (error) {
        console.error('❌ Color distribution analysis failed:', error)
        throw error
      }
    })
  })
})