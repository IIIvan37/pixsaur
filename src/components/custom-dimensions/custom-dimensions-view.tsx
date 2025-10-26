import { useId } from 'react'
import type { ValidationResult } from '@/utils/validate-custom-dimensions'
import styles from './custom-dimensions.module.css'

interface CustomDimensionsViewProps {
  readonly width: number
  readonly height: number
  readonly widthStep: number
  readonly heightStep: number
  readonly validation: ValidationResult
  readonly presets: ReadonlyArray<{
    readonly name: string
    readonly width: number
    readonly height: number
  }>
  readonly onWidthChange: (value: number) => void
  readonly onHeightChange: (value: number) => void
  readonly onPresetClick: (width: number, height: number) => void
}

export const CustomDimensionsView = ({
  width,
  height,
  widthStep,
  heightStep,
  validation,
  presets,
  onWidthChange,
  onHeightChange,
  onPresetClick
}: CustomDimensionsViewProps) => {
  const widthId = useId()
  const heightId = useId()

  return (
    <div className={styles.container}>
      {/* Presets */}
      <div className={styles.presetsSection}>
        <span className={styles.sectionLabel}>Presets:</span>
        <div className={styles.presetButtons}>
          {presets.map((preset) => (
            <button
              key={preset.name}
              type='button'
              onClick={() => onPresetClick(preset.width, preset.height)}
              className={styles.presetButton}
              title={`${preset.width}×${preset.height}`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom dimensions inputs */}
      <div className={styles.inputsSection}>
        <div className={styles.inputGroup}>
          <label htmlFor={widthId} className={styles.inputLabel}>
            Width (×{widthStep}):
          </label>
          <input
            id={widthId}
            type='number'
            min={widthStep}
            max={1024}
            step={widthStep}
            value={width}
            onChange={(e) => onWidthChange(Number(e.target.value))}
            className={`${styles.input} ${validation.errors.some((e) => e.includes('Width')) ? styles.inputError : ''}`}
            aria-label={`Width in pixels, must be multiple of ${widthStep}`}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor={heightId} className={styles.inputLabel}>
            Height (×{heightStep}):
          </label>
          <input
            id={heightId}
            type='number'
            min={heightStep}
            max={544}
            step={heightStep}
            value={height}
            onChange={(e) => onHeightChange(Number(e.target.value))}
            className={`${styles.input} ${validation.errors.some((e) => e.includes('Height')) ? styles.inputError : ''}`}
            aria-label={`Height in lines, must be multiple of ${heightStep}`}
          />
        </div>
      </div>

      {/* Validation feedback */}
      <output
        className={
          validation.valid ? styles.validationOk : styles.validationError
        }
        aria-live='polite'
      >
        {validation.valid ? (
          <>
            ✅ {validation.kb.toFixed(2)} Ko / 64 Ko
            <span className={styles.validationDetails}>
              ({validation.widthInBytes} bytes/line × {height} lines)
            </span>
          </>
        ) : (
          <>
            ❌ {validation.errors[0]}
            {validation.errors.length > 1 && (
              <span className={styles.validationDetails}>
                (+{validation.errors.length - 1} more)
              </span>
            )}
          </>
        )}
      </output>
    </div>
  )
}
