import type { ProcessorType } from '@/app/store/config/types'
import styles from './processor-selector.module.css'

export interface ProcessorSelectorViewProps {
  value: ProcessorType
  onChange: (value: ProcessorType) => void
  hasWebGL: boolean
}

export const ProcessorSelectorView = ({
  value,
  onChange,
  hasWebGL
}: ProcessorSelectorViewProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Processeur:</div>
      <div className={styles.options}>
        <label className={styles.option}>
          <input
            type='radio'
            name='processor'
            value='auto'
            checked={value === 'auto'}
            onChange={(e) => onChange(e.target.value as ProcessorType)}
          />
          <span className={styles.optionLabel}>
            Auto
            {!hasWebGL && (
              <span className={styles.cpuOnly}> (CPU uniquement)</span>
            )}
          </span>
        </label>

        <label className={styles.option}>
          <input
            type='radio'
            name='processor'
            value='cpu'
            checked={value === 'cpu'}
            onChange={(e) => onChange(e.target.value as ProcessorType)}
          />
          <span className={styles.optionLabel}>CPU</span>
        </label>

        <label
          className={`${styles.option} ${!hasWebGL ? styles.disabled : ''}`}
        >
          <input
            type='radio'
            name='processor'
            value='gpu'
            checked={value === 'gpu'}
            disabled={!hasWebGL}
            onChange={(e) => onChange(e.target.value as ProcessorType)}
          />
          <span className={styles.optionLabel}>
            GPU
            {!hasWebGL && (
              <span className={styles.unavailable}> (Non disponible)</span>
            )}
          </span>
        </label>
      </div>
    </div>
  )
}
