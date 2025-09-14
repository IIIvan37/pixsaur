/**
 * Utilitaires pour la détection et l'évaluation des capacités WebGL
 */

/**
 * Résultat de l'évaluation WebGL
 */
export interface WebGLCapabilities {
  isAvailable: boolean
  version: '1.0' | '2.0' | null
  renderer: string | null
  vendor: string | null
  extensions: string[]
  maxTextureSize: number
  maxRenderBufferSize: number
  performance: 'high' | 'medium' | 'low' | 'unknown'
  features: {
    computeShaders: boolean
    floatTextures: boolean
    colorBufferFloat: boolean
    instancedArrays: boolean
  }
}

/**
 * Détecte et évalue les capacités WebGL du navigateur
 */
export function detectWebGLCapabilities(): WebGLCapabilities {
  const result: WebGLCapabilities = {
    isAvailable: false,
    version: null,
    renderer: null,
    vendor: null,
    extensions: [],
    maxTextureSize: 0,
    maxRenderBufferSize: 0,
    performance: 'unknown',
    features: {
      computeShaders: false,
      floatTextures: false,
      colorBufferFloat: false,
      instancedArrays: false
    }
  }

  try {
    // Créer un canvas temporaire
    const canvas = document.createElement('canvas')
    
    // Tester WebGL 2.0 d'abord
    let gl: WebGL2RenderingContext | WebGLRenderingContext | null = canvas.getContext('webgl2')
    if (gl) {
      result.isAvailable = true
      result.version = '2.0'
      
      // WebGL 2.0 a des compute shaders limités
      result.features.computeShaders = false // WebGL 2.0 n'a pas de vrais compute shaders
      result.features.instancedArrays = true // Natif en WebGL 2.0
    } else {
      // Fallback vers WebGL 1.0
      gl = canvas.getContext('webgl')
      if (gl) {
        result.isAvailable = true
        result.version = '1.0'
      }
    }

    if (!gl) {
      return result
    }

    // Obtenir les informations du renderer
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
    }

    // Obtenir les extensions disponibles
    result.extensions = gl.getSupportedExtensions() || []

    // Capacités de texture
    result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    result.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)

    // Tester les extensions importantes
    result.features.floatTextures = result.extensions.includes('OES_texture_float') || 
                                   result.extensions.includes('EXT_texture_float_linear')
    result.features.colorBufferFloat = result.extensions.includes('EXT_color_buffer_float') ||
                                      result.extensions.includes('WEBGL_color_buffer_float')
    
    if (result.version === '1.0') {
      result.features.instancedArrays = result.extensions.includes('ANGLE_instanced_arrays')
    }

    // Évaluer les performances basées sur le renderer
    result.performance = evaluatePerformance(result.renderer, result.vendor, result.maxTextureSize)

    return result

  } catch (error) {
    console.warn('WebGL detection failed:', error)
    return result
  }
}

/**
 * Évalue les performances approximatives basées sur les informations du GPU
 */
function evaluatePerformance(
  renderer: string | null, 
  vendor: string | null, 
  maxTextureSize: number
): 'high' | 'medium' | 'low' | 'unknown' {
  if (!renderer || !vendor) {
    return 'unknown'
  }

  const rendererLower = renderer.toLowerCase()
  const vendorLower = vendor.toLowerCase()

  // GPUs haute performance
  const highPerformanceIndicators = [
    'rtx', 'gtx 1060', 'gtx 1070', 'gtx 1080', 'gtx 1660', 'gtx 1650',
    'rx 580', 'rx 590', 'rx 5600', 'rx 5700', 'rx 6600', 'rx 6700',
    'radeon pro', 'quadro', 'tesla',
    'iris xe', 'iris plus'
  ]

  // GPUs moyennes performance
  const mediumPerformanceIndicators = [
    'gtx 1050', 'gtx 960', 'gtx 970', 'gtx 980',
    'rx 560', 'rx 570', 'rx 470', 'rx 480',
    'iris', 'uhd graphics', 'hd graphics 630'
  ]

  // GPUs basse performance
  const lowPerformanceIndicators = [
    'intel', 'integrated', 'hd graphics', 'uhd graphics 600',
    'mali', 'adreno', 'powervr'
  ]

  // Vérifier les indicateurs haute performance
  if (highPerformanceIndicators.some(indicator => rendererLower.includes(indicator))) {
    return 'high'
  }

  // Vérifier les indicateurs moyenne performance
  if (mediumPerformanceIndicators.some(indicator => rendererLower.includes(indicator))) {
    return 'medium'
  }

  // Vérifier les indicateurs basse performance
  if (lowPerformanceIndicators.some(indicator => rendererLower.includes(indicator))) {
    return 'low'
  }

  // Utiliser la taille max de texture comme fallback
  if (maxTextureSize >= 8192) {
    return 'high'
  } else if (maxTextureSize >= 4096) {
    return 'medium'
  } else if (maxTextureSize >= 2048) {
    return 'low'
  }

  return 'unknown'
}

/**
 * Vérifie si WebGL est recommandé pour le traitement d'images
 */
export function isWebGLRecommended(): boolean {
  const capabilities = detectWebGLCapabilities()
  
  if (!capabilities.isAvailable) {
    return false
  }

  // Critères minimums pour recommander WebGL
  const hasRequiredFeatures = 
    capabilities.features.floatTextures && 
    capabilities.maxTextureSize >= 2048

  const hasGoodPerformance = 
    capabilities.performance === 'high' || 
    capabilities.performance === 'medium'

  return hasRequiredFeatures && hasGoodPerformance
}

/**
 * Obtient un résumé lisible des capacités WebGL
 */
export function getWebGLSummary(): string {
  const capabilities = detectWebGLCapabilities()
  
  if (!capabilities.isAvailable) {
    return 'WebGL non disponible'
  }

  const features = []
  if (capabilities.features.floatTextures) features.push('Float Textures')
  if (capabilities.features.colorBufferFloat) features.push('Color Buffer Float')
  if (capabilities.features.instancedArrays) features.push('Instanced Arrays')

  return [
    `WebGL ${capabilities.version}`,
    `Performance: ${capabilities.performance}`,
    `Max Texture: ${capabilities.maxTextureSize}px`,
    `Features: ${features.join(', ') || 'Aucune'}`
  ].join(' | ')
}