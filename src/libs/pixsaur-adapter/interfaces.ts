import type { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Configuration pour les ajustements d'image
 */
export interface AdjustmentConfig {
  rgb: { r: number; g: number; b: number }
  brightness: number
  contrast: number
  saturation: number
  posterization: number
}

/**
 * Interface pour les processors d'image supportant CPU et WebGL
 */
export interface ImageProcessor {
  /**
   * Type d'implémentation (cpu ou webgl)
   */
  readonly type: 'cpu' | 'webgl'
  
  /**
   * Disponibilité du processor
   */
  readonly isAvailable: boolean

  /**
   * Applique les ajustements d'image (brightness, contrast, saturation, etc.)
   */
  applyAdjustments(
    imageData: ImageData, 
    adjustments: AdjustmentConfig
  ): Promise<ImageData>

  /**
   * Version synchrone des ajustements pour compatibilité avec les atoms Jotai
   */
  applyAdjustmentsSync(
    imageData: ImageData, 
    adjustments: AdjustmentConfig
  ): ImageData

  /**
   * Quantifie une palette à partir d'un buffer d'image
   */
  quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData,
    targetColors: number,
    basePalette?: Vector[],
    preselected?: Vector[],
    colorSpace?: string
  ): Promise<Vector[]>

  /**
   * Nettoie les ressources (WebGL contexts, etc.)
   */
  dispose(): void
}

/**
 * Factory pour créer les processors adaptés
 */
export interface ProcessorFactory {
  /**
   * Crée le meilleur processor disponible (WebGL en priorité, fallback CPU)
   */
  createBestProcessor(): ImageProcessor
  
  /**
   * Crée un processor CPU spécifiquement
   */
  createCpuProcessor(): ImageProcessor
  
  /**
   * Crée un processor WebGL si disponible
   */
  createWebGlProcessor(): ImageProcessor | null
  
  /**
   * Vérifie si WebGL est disponible
   */
  isWebGlAvailable(): boolean
}