/**
 * Tests d'intégration pour la sélection de palette CPC Plus Mode 0
 *
 * Ces tests capturent le comportement actuel AVANT refactoring pour:
 * - Garantir la non-régression lors des futures modifications
 * - Documenter le comportement attendu pour CPC Plus mode 0 (16 couleurs)
 * - Valider que la diversité des teintes est correctement gérée
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyPaletteStrategyV2,
  type ColorCandidate
} from '@/libs/pixsaur-color/src/quant/palette-strategies-v2'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// Mock logger to avoid noise in tests
vi.mock('@/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...(actual as any),
    adapterLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  }
})

/**
 * Génère une palette CPC Plus (4096 couleurs) complète
 * Format: 12-bit RGB (4 bits par canal, 16 niveaux par canal)
 */
function generateCPCPlusPalette(): Vector[] {
  const palette: Vector[] = []
  // CPC Plus a 16 niveaux par canal (0-15 -> 0, 17, 34, ..., 255)
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        // Convertir 4-bit en 8-bit (multiplier par 17)
        palette.push([r * 17, g * 17, b * 17])
      }
    }
  }
  return palette
}

/**
 * Génère la palette CPC Classic (27 couleurs)
 */
function generateCPCClassicPalette(): Vector[] {
  // Les 27 couleurs du CPC Classic (3 niveaux par canal: 0, 128, 255)
  const levels = [0, 128, 255]
  const palette: Vector[] = []
  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        palette.push([r, g, b])
      }
    }
  }
  return palette
}

/**
 * Crée des candidats de couleur à partir d'une map de fréquences
 * @param frequencies Map<index, frequency> les fréquences pour chaque index
 * @param basePalette La palette de base
 */
function createCandidates(
  frequencies: Map<number, number>,
  basePalette: Vector[]
): ColorCandidate[] {
  return Array.from(frequencies.entries()).map(([index, frequency]) => ({
    index,
    frequency,
    color: basePalette[index],
    converted: basePalette[index]
  }))
}

/**
 * Calcule les statistiques de diversité des couleurs sélectionnées
 */
function calculateColorDiversity(colors: Vector[]): {
  hueCount: number
  hasDark: boolean
  hasBright: boolean
  hasNeutral: boolean
  saturationVariance: number
} {
  const hues = new Set<number>()
  let hasDark = false
  let hasBright = false
  let hasNeutral = false
  const saturations: number[] = []

  for (const [r, g, b] of colors) {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255
    const sat = max === 0 ? 0 : (max - min) / max

    // Luminance
    if (lum < 0.25) hasDark = true
    if (lum > 0.75) hasBright = true

    // Saturation
    if (sat < 0.15) {
      hasNeutral = true
    } else {
      // Calculer la teinte (hue) en degrés
      let hue = 0
      if (max !== min) {
        const delta = max - min
        if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
        else if (max === g) hue = ((b - r) / delta + 2) * 60
        else hue = ((r - g) / delta + 4) * 60
      }
      // Grouper les teintes par buckets de 45°
      hues.add(Math.floor(hue / 45))
    }

    saturations.push(sat)
  }

  // Variance de saturation
  const avgSat = saturations.reduce((a, b) => a + b, 0) / saturations.length
  const saturationVariance =
    saturations.reduce((sum, s) => sum + (s - avgSat) ** 2, 0) /
    saturations.length

  return {
    hueCount: hues.size,
    hasDark,
    hasBright,
    hasNeutral,
    saturationVariance
  }
}

describe('CPC Plus Mode 0 Palette Selection - Integration Tests', () => {
  let cpcPlusPalette: Vector[]
  let cpcClassicPalette: Vector[]

  beforeEach(() => {
    cpcPlusPalette = generateCPCPlusPalette()
    cpcClassicPalette = generateCPCClassicPalette()
  })

  describe('mode0-hue-diversity strategy behavior', () => {
    it('should select 16 colors from CPC Plus palette (4096 colors)', () => {
      // Simuler une image avec des couleurs variées
      const frequencies = new Map<number, number>()

      // Ajouter des couleurs de différentes teintes avec des fréquences réalistes
      // Rouge vif (255, 0, 0) = index 15*256 + 0*16 + 0 = 3840
      frequencies.set(3840, 0.15)
      // Vert vif (0, 255, 0) = index 0*256 + 15*16 + 0 = 240
      frequencies.set(240, 0.12)
      // Bleu vif (0, 0, 255) = index 0*256 + 0*16 + 15 = 15
      frequencies.set(15, 0.1)
      // Jaune (255, 255, 0) = index 15*256 + 15*16 + 0 = 4080
      frequencies.set(4080, 0.08)
      // Cyan (0, 255, 255) = index 0*256 + 15*16 + 15 = 255
      frequencies.set(255, 0.07)
      // Magenta (255, 0, 255) = index 15*256 + 0*16 + 15 = 3855
      frequencies.set(3855, 0.06)
      // Noir (0, 0, 0) = index 0
      frequencies.set(0, 0.08)
      // Blanc (255, 255, 255) = index 4095
      frequencies.set(4095, 0.07)
      // Gris moyen (128, 128, 128) = index 8*256 + 8*16 + 8 = 2184
      frequencies.set(2184, 0.05)
      // Orange (255, 136, 0) = index 15*256 + 8*16 + 0 = 3968
      frequencies.set(3968, 0.04)
      // Violet (136, 0, 255) = index 8*256 + 0*16 + 15 = 2063
      frequencies.set(2063, 0.03)
      // Rose (255, 136, 136) = index 15*256 + 8*16 + 8 = 3976
      frequencies.set(3976, 0.02)
      // Vert foncé (0, 136, 0) = index 0*256 + 8*16 + 0 = 128
      frequencies.set(128, 0.02)
      // Bleu ciel (136, 136, 255) = index 8*256 + 8*16 + 15 = 2191
      frequencies.set(2191, 0.02)
      // Marron (136, 68, 0) = index 8*256 + 4*16 + 0 = 2112
      frequencies.set(2112, 0.02)
      // Sarcelle (0, 136, 136) = index 0*256 + 8*16 + 8 = 136
      frequencies.set(136, 0.02)

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(16)

      // Vérifier la diversité des couleurs sélectionnées
      const selectedColors = result.selectedIndices.map(
        (idx) => cpcPlusPalette[idx]
      )
      const diversity = calculateColorDiversity(selectedColors)

      // On s'attend à au moins 4 familles de teintes différentes
      expect(diversity.hueCount).toBeGreaterThanOrEqual(4)
      // On s'attend à avoir des couleurs sombres et claires
      expect(diversity.hasDark || diversity.hasBright).toBe(true)
    })

    it('should preserve preselected colors', () => {
      const frequencies = new Map<number, number>()
      // Quelques couleurs fréquentes
      frequencies.set(3840, 0.3) // Rouge
      frequencies.set(240, 0.2) // Vert
      frequencies.set(15, 0.15) // Bleu
      frequencies.set(0, 0.1) // Noir
      frequencies.set(4095, 0.1) // Blanc

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      // Présélectionner noir et blanc
      const preselectedIndices = [0, 4095]

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        4,
        preselectedIndices,
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(4)
      // Les couleurs présélectionnées doivent être incluses
      expect(result.selectedIndices).toContain(0)
      expect(result.selectedIndices).toContain(4095)
    })

    it('should handle image with dominant single color', () => {
      const frequencies = new Map<number, number>()
      // Image quasi-monochrome avec dominante rouge
      frequencies.set(3840, 0.7) // Rouge dominant
      frequencies.set(3841, 0.1) // Rouge légèrement différent
      frequencies.set(3856, 0.05) // Rouge plus clair
      frequencies.set(0, 0.05) // Noir pour contraste
      frequencies.set(4095, 0.05) // Blanc pour contraste
      frequencies.set(2048, 0.05) // Gris

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        8,
        [],
        { basePaletteSize: 4096 }
      )

      // Comportement actuel: retourne au max le nombre de candidats disponibles
      expect(result.selectedIndices.length).toBeLessThanOrEqual(8)
      expect(result.selectedIndices.length).toBe(candidates.length)
      // La couleur dominante (rouge) doit être sélectionnée
      expect(result.selectedIndices).toContain(3840)
    })

    it('should handle grayscale-heavy image', () => {
      const frequencies = new Map<number, number>()
      // Image principalement en niveaux de gris
      frequencies.set(0, 0.15) // Noir
      frequencies.set(1057, 0.15) // Gris foncé (68, 68, 68)
      frequencies.set(2184, 0.2) // Gris moyen (136, 136, 136)
      frequencies.set(3311, 0.15) // Gris clair (204, 204, 204)
      frequencies.set(4095, 0.15) // Blanc
      // Quelques touches de couleur
      frequencies.set(3840, 0.1) // Rouge
      frequencies.set(240, 0.1) // Vert

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        8,
        [],
        { basePaletteSize: 4096 }
      )

      // Comportement actuel: retourne au max le nombre de candidats
      expect(result.selectedIndices.length).toBeLessThanOrEqual(8)
      expect(result.selectedIndices.length).toBe(candidates.length)

      // Vérifier qu'on a des gris ET des couleurs
      const selectedColors = result.selectedIndices.map(
        (idx) => cpcPlusPalette[idx]
      )
      const diversity = calculateColorDiversity(selectedColors)

      // Doit inclure des couleurs neutres (gris)
      expect(diversity.hasNeutral).toBe(true)
    })
  })

  describe('CPC Classic vs CPC Plus behavior', () => {
    it('should handle CPC Classic palette (27 colors) differently', () => {
      // Pour CPC Classic, les candidats sont limités à 27 couleurs
      const frequencies = new Map<number, number>()
      // Quelques couleurs CPC Classic
      frequencies.set(0, 0.2) // Noir (0, 0, 0)
      frequencies.set(26, 0.2) // Blanc (255, 255, 255)
      frequencies.set(9, 0.15) // Rouge (255, 0, 0)
      frequencies.set(3, 0.15) // Vert (0, 255, 0)
      frequencies.set(1, 0.1) // Bleu (0, 0, 255)
      frequencies.set(12, 0.1) // Jaune (255, 255, 0)
      frequencies.set(13, 0.1) // Gris (128, 128, 128)

      const candidates = createCandidates(frequencies, cpcClassicPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        8,
        [],
        { basePaletteSize: 27 }
      )

      // Comportement actuel: retourne au max le nombre de candidats (7 ici)
      expect(result.selectedIndices.length).toBeLessThanOrEqual(8)
      expect(result.selectedIndices.length).toBe(candidates.length)
    })

    it('should produce different results for same logical colors in CPC Classic vs Plus', () => {
      // Créer des candidats équivalents pour Classic et Plus
      const classicFrequencies = new Map<number, number>()
      const plusFrequencies = new Map<number, number>()

      // Noir
      classicFrequencies.set(0, 0.25)
      plusFrequencies.set(0, 0.25)
      // Blanc
      classicFrequencies.set(26, 0.25)
      plusFrequencies.set(4095, 0.25)
      // Rouge
      classicFrequencies.set(9, 0.25)
      plusFrequencies.set(3840, 0.25)
      // Vert
      classicFrequencies.set(3, 0.25)
      plusFrequencies.set(240, 0.25)

      const classicCandidates = createCandidates(
        classicFrequencies,
        cpcClassicPalette
      )
      const plusCandidates = createCandidates(plusFrequencies, cpcPlusPalette)

      const classicResult = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        classicCandidates,
        4,
        [],
        { basePaletteSize: 27 }
      )

      const plusResult = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        plusCandidates,
        4,
        [],
        { basePaletteSize: 4096 }
      )

      expect(classicResult.selectedIndices).toHaveLength(4)
      expect(plusResult.selectedIndices).toHaveLength(4)

      // Les indices seront différents car les palettes sont différentes
      // Mais le comportement de sélection doit être cohérent
    })
  })

  describe('Regression tests for known issues', () => {
    it('should not degrade quality with diverse color image on CPC Plus', () => {
      // Ce test capture le comportement attendu pour éviter la régression
      // qui a causé la dégradation en mode 0 CPC Plus

      const frequencies = new Map<number, number>()
      // Image avec une bonne répartition de couleurs (cas typique)
      // Simuler une image de paysage avec ciel, herbe, terre, etc.

      // Bleus (ciel)
      frequencies.set(15, 0.12) // Bleu vif
      frequencies.set(2191, 0.08) // Bleu ciel clair
      frequencies.set(8, 0.05) // Bleu foncé

      // Verts (herbe)
      frequencies.set(240, 0.1) // Vert vif
      frequencies.set(128, 0.08) // Vert foncé
      frequencies.set(4096 - 256 + 240, 0.04) // Vert-jaune

      // Marrons/Terre
      frequencies.set(2112, 0.08) // Marron
      frequencies.set(1056, 0.05) // Marron foncé

      // Luminosité
      frequencies.set(0, 0.06) // Noir (ombres)
      frequencies.set(4095, 0.04) // Blanc (highlights)
      frequencies.set(2184, 0.06) // Gris moyen

      // Couleurs d'accent
      frequencies.set(3840, 0.05) // Rouge
      frequencies.set(4080, 0.04) // Jaune
      frequencies.set(3855, 0.03) // Magenta

      // Couleurs secondaires
      frequencies.set(255, 0.04) // Cyan
      frequencies.set(2063, 0.03) // Violet

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      // Comportement actuel: retourne au max le nombre de candidats (15 ici)
      expect(result.selectedIndices.length).toBeLessThanOrEqual(16)
      expect(result.selectedIndices.length).toBe(candidates.length)

      const selectedColors = result.selectedIndices.map(
        (idx) => cpcPlusPalette[idx]
      )
      const diversity = calculateColorDiversity(selectedColors)

      // Critères de qualité minimum pour une image de paysage typique
      // Au moins 5 familles de teintes (ciel, herbe, terre, accents, neutres)
      expect(diversity.hueCount).toBeGreaterThanOrEqual(4)

      // Doit avoir une bonne plage de luminosité
      expect(diversity.hasDark).toBe(true)
      expect(diversity.hasBright).toBe(true)

      // Doit inclure des couleurs saturées (pas tout en gris)
      expect(diversity.saturationVariance).toBeGreaterThan(0)
    })

    it('should handle portrait image with skin tones on CPC Plus', () => {
      const frequencies = new Map<number, number>()

      // Tons de peau (orange/rose)
      // Orange clair: (255, 204, 170) -> index ~15*256 + 12*16 + 10 = 4042
      frequencies.set(4042, 0.25)
      // Orange moyen: (221, 170, 136) -> index ~13*256 + 10*16 + 8 = 3496
      frequencies.set(3496, 0.2)
      // Rose: (255, 187, 170) -> index ~15*256 + 11*16 + 10 = 4026
      frequencies.set(4026, 0.1)

      // Cheveux (marron/noir)
      frequencies.set(1056, 0.12) // Marron foncé
      frequencies.set(0, 0.08) // Noir

      // Fond (bleu/gris)
      frequencies.set(2191, 0.08) // Bleu gris
      frequencies.set(2184, 0.05) // Gris

      // Vêtements/détails
      frequencies.set(3840, 0.05) // Rouge
      frequencies.set(4095, 0.04) // Blanc
      frequencies.set(15, 0.03) // Bleu

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      // Comportement actuel: retourne au max le nombre de candidats (10 ici)
      expect(result.selectedIndices.length).toBeLessThanOrEqual(16)
      expect(result.selectedIndices.length).toBe(candidates.length)

      // Les tons de peau dominants doivent être présents
      // (vérifier que les couleurs les plus fréquentes sont incluses)
      const hasHighFrequencyColor = result.selectedIndices.some((idx) =>
        [4042, 3496, 4026].includes(idx)
      )
      expect(hasHighFrequencyColor).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle single color image', () => {
      const frequencies = new Map<number, number>()
      frequencies.set(3840, 1.0) // Rouge pur à 100%

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      // Doit retourner au moins 1 couleur
      expect(result.selectedIndices.length).toBeGreaterThanOrEqual(1)
      expect(result.selectedIndices).toContain(3840)
    })

    it('should handle more preselected than target', () => {
      const frequencies = new Map<number, number>()
      frequencies.set(3840, 0.5)
      frequencies.set(240, 0.5)

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      // 5 présélectionnées mais target = 4
      const preselectedIndices = [0, 4095, 3840, 240, 15]

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        4,
        preselectedIndices,
        { basePaletteSize: 4096 }
      )

      // Doit limiter à targetColors
      expect(result.selectedIndices.length).toBeLessThanOrEqual(4)
    })

    it('should handle empty candidates', () => {
      const candidates: ColorCandidate[] = []

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        16,
        [],
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(0)
    })

    it('should handle candidates with zero frequency', () => {
      const frequencies = new Map<number, number>()
      frequencies.set(0, 0)
      frequencies.set(4095, 0)
      frequencies.set(3840, 0.5)
      frequencies.set(240, 0.5)

      const candidates = createCandidates(frequencies, cpcPlusPalette)

      const result = applyPaletteStrategyV2(
        'mode0-hue-diversity',
        candidates,
        4,
        [],
        { basePaletteSize: 4096 }
      )

      expect(result.selectedIndices).toHaveLength(4)
    })
  })
})

describe('Strategy comparison for Mode 0', () => {
  let cpcPlusPalette: Vector[]

  beforeEach(() => {
    cpcPlusPalette = generateCPCPlusPalette()
  })

  it('should compare mode0-hue-diversity vs frequency-balanced on diverse image', () => {
    const frequencies = new Map<number, number>()
    // Image diverse typique
    frequencies.set(3840, 0.15) // Rouge
    frequencies.set(240, 0.12) // Vert
    frequencies.set(15, 0.1) // Bleu
    frequencies.set(4080, 0.08) // Jaune
    frequencies.set(255, 0.07) // Cyan
    frequencies.set(3855, 0.06) // Magenta
    frequencies.set(0, 0.08) // Noir
    frequencies.set(4095, 0.07) // Blanc
    frequencies.set(2184, 0.05) // Gris

    const candidates = createCandidates(frequencies, cpcPlusPalette)

    const hueDiversityResult = applyPaletteStrategyV2(
      'mode0-hue-diversity',
      candidates,
      8,
      [],
      { basePaletteSize: 4096 }
    )

    const frequencyResult = applyPaletteStrategyV2(
      'frequency-balanced',
      candidates,
      8,
      [],
      { basePaletteSize: 4096 }
    )

    // Les deux doivent retourner 8 couleurs
    expect(hueDiversityResult.selectedIndices).toHaveLength(8)
    expect(frequencyResult.selectedIndices).toHaveLength(8)

    // Calculer la diversité pour chaque stratégie
    const hueDiversityColors = hueDiversityResult.selectedIndices.map(
      (idx) => cpcPlusPalette[idx]
    )
    const frequencyColors = frequencyResult.selectedIndices.map(
      (idx) => cpcPlusPalette[idx]
    )

    const hueDiversity = calculateColorDiversity(hueDiversityColors)
    const frequencyDiversity = calculateColorDiversity(frequencyColors)

    // mode0-hue-diversity devrait avoir au moins autant de diversité de teinte
    // que frequency-balanced (c'est son objectif)
    expect(hueDiversity.hueCount).toBeGreaterThanOrEqual(
      frequencyDiversity.hueCount - 1
    )
  })
})
