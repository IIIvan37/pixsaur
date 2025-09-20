import type { ReactNode } from 'react'
import clsx from 'clsx'
import animStyles from '@/styles/animations.module.css'
import styles from './toggle-button-group.module.css'

export type ToggleButtonOption<T = string> = {
  /** Valeur unique de l'option */
  value: T
  /** Libellé affiché dans le bouton */
  label: ReactNode
  /** Label d'accessibilité (par défaut: utilise label) */
  ariaLabel?: string
}

export type ToggleButtonGroupProps<T = string> = {
  /** Options disponibles */
  options: ToggleButtonOption<T>[]
  /** Valeur actuellement sélectionnée */
  value: T
  /** Callback lors du changement de valeur */
  onChange: (value: T) => void
  /** Classes CSS supplémentaires */
  className?: string
  /** Préfixe pour les aria-labels (ex: "Mode", "ColorSpace") */
  ariaLabelPrefix?: string
}

/**
 * Composant ToggleButtonGroup unifié - DRY principle implementation
 * 
 * Remplace les patterns de boutons dupliqués dans :
 * - image-controls-view.tsx (renderModeButton, renderColorSpaceButton)
 * - contrast-strategy-selector.tsx (renderStrategyButton)
 * 
 * @example
 * ```tsx
 * <ToggleButtonGroup
 *   options={[
 *     { value: 'mode0', label: 'Mode 0' },
 *     { value: 'mode1', label: 'Mode 1' }
 *   ]}
 *   value={currentMode}
 *   onChange={setMode}
 *   ariaLabelPrefix="Mode"
 * />
 * ```
 */
export function ToggleButtonGroup<T extends string | number>({ 
  options,
  value,
  onChange,
  className = '',
  ariaLabelPrefix
}: ToggleButtonGroupProps<T>) {
  return (
    <div className={`${styles.buttonGroup} ${className}`.trim()}>
      {options.map((option) => {
        const isActive = value === option.value
        const ariaLabel = option.ariaLabel || 
          (ariaLabelPrefix ? `${ariaLabelPrefix} ${option.label}` : String(option.label))
        
        return (
          <button
            key={String(option.value)}
            className={clsx(
              styles.toggleButton,
              animStyles.modeButton,
              isActive
                ? [styles.toggleButtonActive, animStyles.modeButtonActive]
                : [styles.toggleButtonInactive, animStyles.modeButtonInactive]
            )}
            onClick={() => onChange(option.value)}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            type='button'
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}