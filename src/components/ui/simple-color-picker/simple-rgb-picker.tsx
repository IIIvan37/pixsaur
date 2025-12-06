import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import Button from '../button'
import Flex from '../flex'
import { RgbSlider } from '../rgb-slider'
import styles from './simple-color-picker.module.css'

export interface SimpleRgbPickerProps {
  /** Initial color value */
  readonly initialColor: Vector
  /** Callback when color is confirmed */
  readonly onColorConfirm: (color: Vector) => void
  /** Callback to close the picker */
  readonly onClose: () => void
}

/**
 * Simple RGB picker for CPC Plus mode (4096 colors)
 * Only sliders and confirm/cancel - no lock/clear buttons
 */
export function SimpleRgbPicker({
  initialColor,
  onColorConfirm,
  onClose
}: SimpleRgbPickerProps) {
  const [workingColor, setWorkingColor] = useState<Vector>(initialColor)

  const handleConfirm = () => {
    onColorConfirm(workingColor)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const [r, g, b] = workingColor

  return (
    <div className={styles.rgbPicker}>
      {/* Color preview */}
      <div
        className={styles.colorPreview}
        style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
        title={`RGB(${r}, ${g}, ${b})`}
      >
        <span className={styles.colorValue}>
          RGB({r}, {g}, {b})
        </span>
      </div>

      {/* RGB Sliders */}
      <div className={styles.slidersContainer}>
        <RgbSlider
          value={workingColor}
          onChange={setWorkingColor}
          label=''
          showPreview={false}
        />
      </div>

      {/* Actions */}
      <Flex direction='row' justify='space-between' align='center' gap='small'>
        <Button variant='secondary' onClick={handleCancel}>
          <Trans>Annuler</Trans>
        </Button>
        <Button variant='primary' onClick={handleConfirm}>
          <Trans>Valider</Trans>
        </Button>
      </Flex>
    </div>
  )
}
