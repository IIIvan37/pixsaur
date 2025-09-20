import { useAtom } from 'jotai'
import {
  contrastStrategyAtom,
  modeAtom,
  setContrastStrategyAtom
} from '@/app/store/config/config'
import type { ContrastStrategy } from '@/app/store/config/types'
import Flex from '@/components/ui/flex'
import { SectionTitle } from '@/components/ui/section-title'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'

/**
 * Sélecteur de stratégie de contraste pour les modes CPC 1 et 2
 * Permet de choisir entre contraste maximum et approche équilibrée
 */
export function ContrastStrategySelector() {
  const [contrastStrategy] = useAtom(contrastStrategyAtom)
  const [, setContrastStrategyValue] = useAtom(setContrastStrategyAtom)
  const [mode] = useAtom(modeAtom)

  // Ne montrer le sélecteur que pour les modes 1 et 2 (petites palettes)
  const shouldShow =
    mode === '1' ||
    mode === '2' ||
    mode === '1-overscan' ||
    mode === '2-overscan'

  if (!shouldShow) {
    return null
  }

  const handleStrategyChange = (strategy: ContrastStrategy) => {
    setContrastStrategyValue(strategy)
  }

  const strategyOptions = [
    {
      value: 'max' as ContrastStrategy,
      label: 'Max',
      ariaLabel: 'Max - Contraste maximum - Idéal pour images détaillées'
    },
    {
      value: 'balanced' as ContrastStrategy,
      label: 'Équilibré',
      ariaLabel: 'Équilibré - Équilibre fréquence/contraste - Meilleur pour dominantes colorées'
    }
  ]

  return (
    <Flex align='center'>
      <SectionTitle>Contraste</SectionTitle>
      <ToggleButtonGroup
        options={strategyOptions}
        value={contrastStrategy}
        onChange={handleStrategyChange}
        ariaLabelPrefix="Contraste"
      />
    </Flex>
  )
}
