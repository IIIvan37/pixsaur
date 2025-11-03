import { Trans } from '@lingui/react/macro'
import PixsaurSlider from '@/components/ui/slider/slider'
import styles from './custom-dimensions-input.module.css'

export interface CustomDimensionsInputViewProps {
  readonly localWidth: number
  readonly localHeight: number
  readonly maxWidth: number
  readonly maxHeight: number
  readonly widthStep: number
  readonly bytesPerLine: number
  readonly validation: {
    readonly valid: boolean
    readonly kb: number
    readonly errors: readonly string[]
  }
  readonly onWidthChange: (value: number) => void
  readonly onHeightChange: (value: number) => void
}

export function CustomDimensionsInputView({
  localWidth,
  localHeight,
  maxWidth,
  maxHeight,
  widthStep,
  bytesPerLine,
  validation,
  onWidthChange,
  onHeightChange
}: CustomDimensionsInputViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.slidersGrid}>
        <PixsaurSlider
          min={widthStep}
          max={maxWidth}
          step={widthStep}
          value={localWidth}
          onChange={onWidthChange}
          label={
            <>
              <Trans>Largeur</Trans> ({localWidth}px / {bytesPerLine.toFixed(0)}{' '}
              octets)
            </>
          }
        />

        <PixsaurSlider
          min={8}
          max={maxHeight}
          step={8}
          value={localHeight}
          onChange={onHeightChange}
          label={
            <>
              <Trans>Hauteur</Trans> ({localHeight}px)
            </>
          }
        />
      </div>

      <div
        className={
          validation.valid ? styles.validationOk : styles.validationError
        }
      >
        {validation.valid ? (
          <>
            <Trans>Mémoire</Trans>: {validation.kb.toFixed(2)} Ko / 64 Ko
          </>
        ) : (
          validation.errors.join(', ')
        )}
      </div>
    </div>
  )
}
