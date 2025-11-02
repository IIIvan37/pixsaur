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
}

export function PaletteStrategySelectorView({
  strategies,
  currentStrategy,
  currentDescription,
  onStrategyChange
}: PaletteStrategySelectorViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Stratégie de palette</div>
      <Select
        value={currentStrategy}
        onValueChange={(value) => onStrategyChange(value as PaletteStrategy)}
      >
        {strategies.map((strategy) => (
          <SelectItem key={strategy.value} value={strategy.value}>
            {strategy.label}
          </SelectItem>
        ))}
      </Select>
      {currentDescription && (
        <div className={styles.description}>{currentDescription}</div>
      )}
    </div>
  )
}
