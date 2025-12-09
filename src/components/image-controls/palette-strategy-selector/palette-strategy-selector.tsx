import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtom, useAtomValue } from 'jotai'
import { useMemo } from 'react'
import {
  effectiveModeConfigAtom,
  paletteStrategyAtom
} from '@/app/store/config/config'
import type { PaletteStrategy } from '@/app/store/config/types'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { logger } from '@/core'
import {
  type PaletteStrategyOption,
  PaletteStrategySelectorView
} from './palette-strategy-selector-view'

const getPaletteStrategies = (
  _: (message: { id: string; message?: string }) => string
): readonly PaletteStrategyOption[] =>
  [
    {
      value: 'exhaustive-contrast',
      label: _(
        msg({
          id: 'palette.strategy.exhaustive-contrast.label',
          message: 'Exhaustive Contrast'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.exhaustive-contrast.desc',
          message: 'Tests all combinations, maximizes contrast (best quality)'
        })
      )
    },
    {
      value: 'coverage-aware',
      label: _(
        msg({
          id: 'palette.strategy.coverage-aware.label',
          message: 'Coverage Aware'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.coverage-aware.desc',
          message: 'Maximizes pixel coverage (minimizes global error)'
        })
      )
    },
    {
      value: 'dithering-aware',
      label: _(
        msg({
          id: 'palette.strategy.dithering-aware.label',
          message: 'Dithering Aware'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.dithering-aware.desc',
          message: 'Selects colors that blend well in dithering'
        })
      )
    },
    {
      value: 'frequency-balanced',
      label: _(
        msg({
          id: 'palette.strategy.frequency-balanced.label',
          message: 'Frequency Balanced'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.frequency-balanced.desc',
          message: 'Frequency priority (80%) with moderate diversity'
        })
      )
    },
    {
      value: 'frequency-max',
      label: _(
        msg({
          id: 'palette.strategy.frequency-max.label',
          message: 'Frequency Contrast'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.frequency-max.desc',
          message: 'Balanced frequency (60%) and diversity (40%)'
        })
      )
    },
    {
      value: 'balanced-score-balanced',
      label: _(
        msg({
          id: 'palette.strategy.balanced-score-balanced.label',
          message: 'Balanced Score'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.balanced-score-balanced.desc',
          message: 'Multi-criteria balanced (50% freq, 25% div, 25% lum)'
        })
      )
    },
    {
      value: 'balanced-score-max',
      label: _(
        msg({
          id: 'palette.strategy.balanced-score-max.label',
          message: 'Balanced Contrast Max'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.balanced-score-max.desc',
          message: 'Multi-criteria with contrast (30% freq, 35% div, 35% lum)'
        })
      )
    },
    {
      value: 'perceptual-balanced',
      label: _(
        msg({
          id: 'palette.strategy.perceptual-balanced.label',
          message: 'Perceptual Balanced'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.perceptual-balanced.desc',
          message: 'Luminance bins with frequency priority'
        })
      )
    },
    {
      value: 'perceptual-max',
      label: _(
        msg({
          id: 'palette.strategy.perceptual-max.label',
          message: 'Perceptual Contrast'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.perceptual-max.desc',
          message: 'Luminance bins with diversity priority'
        })
      )
    },
    {
      value: 'diversity-first-balanced',
      label: _(
        msg({
          id: 'palette.strategy.diversity-first-balanced.label',
          message: 'Diversity Balanced'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.diversity-first-balanced.desc',
          message: 'Dominant diversity (90%) with slight frequency (10%)'
        })
      )
    },
    {
      value: 'diversity-first-max',
      label: _(
        msg({
          id: 'palette.strategy.diversity-first-max.label',
          message: 'Pure Diversity'
        })
      ),
      description: _(
        msg({
          id: 'palette.strategy.diversity-first-max.desc',
          message: 'Maximum diversity (100%), frequency ignored'
        })
      )
    },
    {
      value: 'adaptive',
      label: _(
        msg({ id: 'palette.strategy.adaptive.label', message: 'Adaptive' })
      ),
      description: _(
        msg({
          id: 'palette.strategy.adaptive.desc',
          message: 'Dynamic strategy based on image'
        })
      )
    }
  ] as const

// Hook to check if palette strategy is disabled
export function usePaletteStrategyDisabled() {
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  return modeConfig.nColors >= 16 || rasterEnabled
}

export function PaletteStrategySelector() {
  const { _ } = useLingui()
  const [paletteStrategy, setPaletteStrategy] = useAtom(paletteStrategyAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)

  const paletteStrategies = useMemo(() => getPaletteStrategies(_), [_])

  const handleStrategyChange = (value: PaletteStrategy) => {
    logger.info('[PaletteStrategy] Changing strategy', {
      from: paletteStrategy,
      to: value
    })
    setPaletteStrategy(value)
  }

  // Visible uniquement pour les modes avec moins de 16 couleurs (mode 1: 4 couleurs, mode 2: 2 couleurs)
  if (modeConfig.nColors >= 16) {
    return null
  }

  const currentStrategy = paletteStrategies.find(
    (s) => s.value === paletteStrategy
  )

  // Disable when raster mode is enabled - raster uses its own per-line palette extraction
  if (rasterEnabled) {
    return (
      <PaletteStrategySelectorView
        strategies={paletteStrategies}
        currentStrategy={paletteStrategy}
        currentDescription={currentStrategy?.description}
        onStrategyChange={handleStrategyChange}
        disabled={true}
        disabledReason={_(
          msg({
            id: 'palette.strategy.disabled.raster',
            message: 'Non utilisée en mode raster (palette extraite par ligne)'
          })
        )}
      />
    )
  }

  return (
    <PaletteStrategySelectorView
      strategies={paletteStrategies}
      currentStrategy={paletteStrategy}
      currentDescription={currentStrategy?.description}
      onStrategyChange={handleStrategyChange}
    />
  )
}
