import clsx from 'clsx'
import { useAtom } from 'jotai'
import {
  contrastStrategyAtom,
  modeAtom,
  setContrastStrategyAtom
} from '@/app/store/config/config'
import type { ContrastStrategy } from '@/app/store/config/types'
import Flex from '@/components/ui/flex'
import animStyles from '@/styles/animations.module.css'
import { isDevelopment } from '@/utils/is-development'
import styles from '../image-controls.module.css'

/**
 * Sélecteur de stratégie de contraste pour les modes CPC 1 et 2
 * Permet de choisir entre contraste maximum et approche équilibrée
 */
export function ContrastStrategySelector() {
  const [contrastStrategy] = useAtom(contrastStrategyAtom)
  const [, setContrastStrategyValue] = useAtom(setContrastStrategyAtom)
  const [mode] = useAtom(modeAtom)

  // N'afficher le sélecteur qu'en mode développement
  if (!isDevelopment()) {
    return null
  }

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

  const renderStrategyButton = (
    strategy: ContrastStrategy,
    label: string,
    description: string
  ) => (
    <button
      key={strategy}
      className={clsx(
        styles.modeButton,
        animStyles.modeButton,
        contrastStrategy === strategy
          ? [styles.modeButtonActive, animStyles.modeButtonActive]
          : [styles.modeButtonInactive, animStyles.modeButtonInactive]
      )}
      onClick={() => handleStrategyChange(strategy)}
      aria-label={`${label} - ${description}`}
      aria-pressed={contrastStrategy === strategy}
      type='button'
      title={description}
    >
      {label}
    </button>
  )

  return (
    <Flex align='center'>
      <h2 className={styles.sectionTitle}>Contraste</h2>
      <div className={styles.modeButtonsRow}>
        {renderStrategyButton(
          'max',
          'Max',
          'Contraste maximum - Idéal pour images détaillées'
        )}
        {renderStrategyButton(
          'balanced',
          'Équilibré',
          'Équilibre fréquence/contraste - Meilleur pour dominantes colorées'
        )}
      </div>
    </Flex>
  )
}
