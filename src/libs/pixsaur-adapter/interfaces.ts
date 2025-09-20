import type { Vector } from '@/libs/pixsaur-color/src/type'

export type ProcessorType = 'auto' | 'cpu' | 'gpu'

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
 * Interface pour les processors d'image supportant CPU, WebGL et ReGL
 */
export interface ImageProcessor {
  /**
   * Type d'implémentation (cpu, webgl ou regl)
   */
  readonly type: 'cpu' | 'webgl' | 'regl'

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
   * Signature standardisée basée sur l'usage réel dans preview.ts
   * Colorspace fixé sur RGB pour optimisation GPU
   */
  quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    contrastStrategy?: 'max' | 'balanced'
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
   * Crée le meilleur processor disponible (ReGL en priorité, fallback CPU)
   * @param processorType - Type de processor à utiliser ('auto', 'cpu', 'gpu')
   */
  createBestProcessor(processorType?: ProcessorType): Promise<ImageProcessor>

  /**
   * Crée un processor CPU spécifiquement
   */
  createCpuProcessor(): ImageProcessor

  /**
   * Crée un processor ReGL si disponible
   */
  createReGlProcessor(): Promise<ImageProcessor | null>

  /**
   * Vérifie si WebGL est disponible (nécessaire pour ReGL)
   */
  isWebGlAvailable(): boolean
}
