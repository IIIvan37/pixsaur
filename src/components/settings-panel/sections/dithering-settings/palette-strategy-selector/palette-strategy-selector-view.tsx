import type { PaletteStrategy } from '@/app/store/config/types'
import { Select, SelectItem } from '@/components/ui/select'
import styles from './palette-strategy-selector.module.css'

export interface PaletteStrategyOption {
  readonly value: PaletteStrategy
  readonly label: string
  readonly description: string
}

export interface PaletteStrategySelectorViewProps {
  readonly strategies: readonly PaletteStrategyOption[]
  readonly currentStrategy: PaletteStrategy
  readonly currentDescription?: string
  readonly onStrategyChange: (value: PaletteStrategy) => void
  readonly disabled?: boolean
  readonly disabledReason?: string
}

export function PaletteStrategySelectorView({
  strategies,
  currentStrategy,
  currentDescription,
  onStrategyChange,
  disabled = false,
  disabledReason
}: PaletteStrategySelectorViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label} style={{ opacity: disabled ? 0.5 : 1 }}>
        Stratégie de palette
      </div>
      <Select
        value={currentStrategy}
        onValueChange={(value) => onStrategyChange(value as PaletteStrategy)}
        disabled={disabled}
      >
        {strategies.map((strategy) => (
          <SelectItem key={strategy.value} value={strategy.value}>
            {strategy.label}
          </SelectItem>
        ))}
      </Select>
      {disabled && disabledReason ? (
        <div className={styles.disabledReason}>{disabledReason}</div>
      ) : (
        currentDescription && (
          <div className={styles.description}>{currentDescription}</div>
        )
      )}
    </div>
  )
}
