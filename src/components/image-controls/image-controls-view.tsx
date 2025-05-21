import { CPC_MODE_CONFIG, CpcModeKey } from '@/app/store/config/types'
import { ColorSpace } from '@/libs/pixsaur-color/src/type'
import { Flex, Heading } from '@radix-ui/themes'
import Slider from '@/components/ui/slider'
import styles from './image-controls.module.css'
import animStyles from '@/styles/animations.module.css'
import clsx from 'clsx'

export type ImageControlsViewProps = {
  mode: CpcModeKey
  onModeChange: (mode: CpcModeKey) => void
  dithering: { intensity: number }
  onDitheringChange: (dithering: { intensity: number }) => void
  colorSpace: ColorSpace
  onColorSpaceChange: (colorSpace: ColorSpace) => void
}

/**
 * Renders the image controls UI, allowing users to select the image processing mode,
 * adjust dithering intensity, and choose the color space.
 *
 * @param props - The props for the ImageControlsView component.
 * @param props.mode - The current image processing mode.
 * @param props.onModeChange - Callback invoked when the mode is changed.
 * @param props.dithering - The current dithering settings, including intensity.
 * @param props.onDitheringChange - Callback invoked when the dithering intensity is changed.
 * @param props.colorSpace - The currently selected color space.
 * @param props.onColorSpaceChange - Callback invoked when the color space is changed.
 *
 * @returns The rendered image controls view component.
 */
export function ImageControlsView({
  mode,
  onModeChange,
  dithering,
  onDitheringChange,
  colorSpace,
  onColorSpaceChange
}: ImageControlsViewProps) {
  const renderModeButton = (key: string) => (
    <button
      key={`mode_${key}`}
      className={clsx(
        styles.modeButton,
        animStyles.modeButton,
        mode === key
          ? [styles.modeButtonActive, animStyles.modeButtonActive]
          : [styles.modeButtonInactive, animStyles.modeButtonInactive]
      )}
      onClick={() => onModeChange(key as CpcModeKey)}
      aria-label={`Mode ${key}`}
      aria-pressed={mode === key}
      type='button'
    >
      {key}
    </button>
  )

  const renderColorSpaceButton = (space: ColorSpace) => (
    <button
      key={space}
      className={clsx(
        styles.modeButton,
        animStyles.modeButton,
        colorSpace === space
          ? [styles.modeButtonActive, animStyles.modeButtonActive]
          : [styles.modeButtonInactive, animStyles.modeButtonInactive]
      )}
      onClick={() => onColorSpaceChange(space)}
      aria-label={`ColorSpace ${space}`}
      aria-pressed={colorSpace === space}
      type='button'
    >
      {space}
    </button>
  )

  return (
    <div className={styles.controlsContainer}>
      <Flex align='center' mb='2'>
        <Heading size='2' className={styles.sectionTitle}>
          Mode
        </Heading>
        <div className={styles.modeButtonsRow}>
          {Object.keys(CPC_MODE_CONFIG).map(renderModeButton)}
        </div>
      </Flex>
      <div className={styles.ditheringSlider}>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={dithering.intensity}
          onChange={(intensity) => onDitheringChange({ intensity })}
          label='Tramage'
          compact
          size='small'
        />
      </div>
      <Flex align='center' mb='2'>
        <Heading size='2' className={styles.sectionTitle}>
          Espace de couleur
        </Heading>
        <div className={styles.modeButtonsRow}>
          {(['RGB', 'XYZ', 'Lab'] as ColorSpace[]).map(renderColorSpaceButton)}
        </div>
      </Flex>
    </div>
  )
}
