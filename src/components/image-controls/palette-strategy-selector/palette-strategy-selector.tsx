import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { paletteStrategyAtom } from '@/app/store/config/config'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import { logger } from '@/utils/logger'

const PALETTE_STRATEGIES = [
  {
    value: 'frequency',
    label: 'Fréquence (Original)',
    description: 'Tri par fréquence avec diversité'
  },
  {
    value: 'balanced-score',
    label: 'Score Équilibré',
    description: 'Multi-critères (fréquence + diversité + contraste)'
  },
  {
    value: 'perceptual',
    label: 'Perceptuel',
    description: 'Basé sur la luminance'
  },
  {
    value: 'adaptive',
    label: 'Adaptatif',
    description: "Stratégie dynamique selon l'image"
  }
] as const

export function PaletteStrategySelector() {
  const [paletteStrategy, setPaletteStrategy] = useAtom(paletteStrategyAtom)

  const handleStrategyChange = (value: string) => {
    logger.info('[PaletteStrategy] Changing strategy', {
      from: paletteStrategy,
      to: value
    })
    setPaletteStrategy(value as typeof paletteStrategy)
  }

  // TODO: Masquer en production une fois les tests terminés
  // Afficher toujours pour les tests
  const showSelector = true // isDevelopment()

  if (!showSelector) {
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
