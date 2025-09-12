// Interface commune pour les processeurs d'image (WebGL hard vs CPU soft)
export interface IImageAdjustmentConfig {
  rgb: { r: number; g: number; b: number }
  brightness: number
  contrast: number
  saturation: number
  posterization: number
}

export interface IQuantizationConfig {
  // Pour l'instant simple pour CPC, extensible pour d'autres systèmes
  targetPalette?: 'cpc' | 'custom'
  customLevels?: number[] // ex: [0, 128, 255] pour CPC
}

export interface IDitheringConfig {
  mode: 'none' | 'floyd-steinberg' | 'bayer'
  intensity: number
}

// Interface principale pour le traitement d'image
export interface IImageProcessor {
  // Capacités de l'adaptateur
  isHardwareAccelerated: boolean
  isAvailable(): boolean
  
  // Méthodes de traitement
  applyAdjustments(imageData: ImageData, config: IImageAdjustmentConfig): Promise<ImageData>
  quantizeColors(imageData: ImageData, config: IQuantizationConfig): Promise<ImageData>
  applyDithering(imageData: ImageData, palette: number[][], config: IDitheringConfig): Promise<ImageData>
  
  // Pipeline unifié (optionnel - pour optimisation WebGL multi-pass)
  processComplete(
    imageData: ImageData, 
    adjustments: IImageAdjustmentConfig,
    quantization: IQuantizationConfig,
    dithering: IDitheringConfig,
    palette: number[][]
  ): Promise<ImageData>
  
  // Gestion des ressources
  dispose(): void
}

// Interface pour la sélection/réduction de palette
export interface IPaletteProcessor {
  isHardwareAccelerated: boolean
  isAvailable(): boolean
  
  // Analyse des couleurs de l'image pour créer une palette réduite
  extractDominantColors(imageData: ImageData, maxColors: number): Promise<number[][]>
  
  dispose(): void
}