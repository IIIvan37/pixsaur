import type { IPaletteProcessor } from '../interfaces/image-processor'

export class CPUPaletteProcessor implements IPaletteProcessor {
  public readonly isHardwareAccelerated = false
  
  isAvailable(): boolean {
    return true
  }
  
  async extractDominantColors(imageData: ImageData, maxColors: number): Promise<number[][]> {
    // TODO: Implémenter l'extraction de couleurs dominantes CPU
    // Pour l'instant retourne une palette CPC basique
    const cpcBasic = [
      [0, 0, 0],       // Noir
      [128, 0, 0],     // Rouge
      [0, 128, 0],     // Vert
      [128, 128, 0],   // Jaune
      [0, 0, 128],     // Bleu
      [128, 0, 128],   // Magenta
      [0, 128, 128],   // Cyan
      [255, 255, 255], // Blanc
    ]
    
    return cpcBasic.slice(0, Math.min(maxColors, cpcBasic.length))
  }
  
  dispose(): void {
    // Rien à nettoyer
  }
}