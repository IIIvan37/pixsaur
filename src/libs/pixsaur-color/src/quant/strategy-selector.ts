/**
 * Sélecteur de stratégie de contraste DRY
 * Factorisation de la logique commune entre CPU et GPU quantizers
 */

import type { Vector } from '@/libs/pixsaur-color/src/type'
import { logger } from '@/utils/logger'
import {
  selectBalancedSubset,
  selectContrastedSubset
} from './select-contrast-subset'

export interface StrategyConfig {
  contrastStrategy?: 'max' | 'balanced'
  targetColors: number
}

export interface SelectionParams {
  candidates: Vector[]
  preselected: Vector[]
  targetColors: number
  distanceFn: (a: Vector, b: Vector) => number
  toRGB: (v: Vector) => Vector
}

/**
 * Sélectionne la stratégie de contraste appropriée et applique l'algorithme
 * Logique commune entre CPU et GPU quantizers
 */
export function selectByStrategy(
  config: StrategyConfig,
  params: SelectionParams
): Vector[] {
  const strategy = config.contrastStrategy ?? 'max'

  logger.debug(
    `[STRATEGY] Using strategy: ${strategy}, targetColors: ${config.targetColors}, condition: ${config.targetColors <= 4 && strategy === 'balanced'}`
  )

  if (config.targetColors <= 4 && strategy === 'balanced') {
    return selectBalancedSubset(
      params.candidates,
      params.preselected,
      params.targetColors,
      params.distanceFn,
      params.toRGB
    )
  } else {
    return selectContrastedSubset(
      params.candidates,
      params.preselected,
      params.targetColors,
      params.distanceFn,
      params.toRGB
    )
  }
}
