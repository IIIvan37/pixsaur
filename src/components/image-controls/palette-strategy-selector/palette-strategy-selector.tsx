import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import {
  effectiveModeConfigAtom,
  paletteStrategyAtom
} from '@/app/store/config/config'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import { logger } from '@/utils/logger'

const PALETTE_STRATEGIES = [
  {
    value: 'frequency-balanced',
    label: 'Fréquence Équilibrée',
    description: 'Fréquence prioritaire (80%) avec diversité modérée'
  },
  {
    value: 'frequency-max',
    label: 'Fréquence Contraste',
    description: 'Équilibre fréquence (60%) et diversité (40%)'
  },
  {
    value: 'balanced-score-balanced',
    label: 'Score Équilibré',
    description: 'Multi-critères équilibrés (50% freq, 25% div, 25% lum)'
  },
  {
    value: 'balanced-score-max',
    label: 'Score Contraste Max',
    description: 'Multi-critères avec contraste (30% freq, 35% div, 35% lum)'
  },
  {
    value: 'perceptual-balanced',
    label: 'Perceptuel Équilibré',
    description: 'Bins de luminance avec fréquence prioritaire'
  },
  {
    value: 'perceptual-max',
    label: 'Perceptuel Contraste',
    description: 'Bins de luminance avec diversité prioritaire'
  },
  {
    value: 'diversity-first-balanced',
    label: 'Diversité Équilibrée',
    description: 'Diversité dominante (90%) avec légère fréquence (10%)'
  },
  {
    value: 'diversity-first-max',
    label: 'Diversité Pure',
    description: 'Diversité maximale (100%), fréquence ignorée'
  },
  {
    value: 'adaptive',
    label: 'Adaptatif',
    description: "Stratégie dynamique selon l'image"
  }
] as const

export function PaletteStrategySelector() {
  const [paletteStrategy, setPaletteStrategy] = useAtom(paletteStrategyAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)

  const handleStrategyChange = (value: string) => {
    logger.info('[PaletteStrategy] Changing strategy', {
      from: paletteStrategy,
      to: value
    })
    setPaletteStrategy(value as typeof paletteStrategy)
  }

  // Visible uniquement pour les modes avec moins de 16 couleurs (mode 1: 4 couleurs, mode 2: 2 couleurs)
  if (modeConfig.nColors >= 16) {
    return null
  }

  const currentStrategy = PALETTE_STRATEGIES.find(
    (s) => s.value === paletteStrategy
  )

  return (
    <Flex
      gap='var(--spacing-md)'
      wrap='wrap'
      justify='flex-start'
      align='flex-start'
    >
      <Flex direction='column' gap='var(--spacing-xs)' align='start'>
        <div
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-foreground)'
          }}
        >
          <Trans>Stratégie de palette</Trans>
        </div>
        <Select value={paletteStrategy} onValueChange={handleStrategyChange}>
          {PALETTE_STRATEGIES.map((strategy) => (
            <SelectItem key={strategy.value} value={strategy.value}>
              {strategy.label}
            </SelectItem>
          ))}
        </Select>
        {currentStrategy && (
          <div
            style={{
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-muted)',
              marginTop: 'var(--spacing-xs)'
            }}
          >
            {currentStrategy.description}
          </div>
        )}
      </Flex>
    </Flex>
  )
}
