import { CPC_MODE_CONFIG, type CpcModeKey } from '@/app/store/config/types'
import type { ColorSpace } from '@/libs/pixsaur-color/src/type'
import Flex from '../ui/flex'
import { SectionTitle } from '../ui/section-title'
import { ToggleButtonGroup } from '../ui/toggle-button-group'
import { ContrastStrategySelector } from './contrast-strategy-selector'
import { DitheringSelector } from './dithering-selector/dithering-selector'
import styles from './image-controls.module.css'
import { ProcessorSelector } from './processor-selector/processor-selector'

export type ImageControlsViewProps = {
  mode: CpcModeKey
  onModeChange: (mode: CpcModeKey) => void
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
  colorSpace,
  onColorSpaceChange
}: Readonly<ImageControlsViewProps>) {
  // Préparer les options pour les groupes de boutons
  const modeOptions = Object.keys(CPC_MODE_CONFIG).map(key => ({
    value: key as CpcModeKey,
    label: key
  }))

  const colorSpaceOptions: Array<{ value: ColorSpace; label: string }> = [
    { value: 'RGB', label: 'RGB' },
    { value: 'XYZ', label: 'XYZ' },
    { value: 'Lab', label: 'Lab' }
  ]

  return (
    <div className={styles.controlsContainer}>
      <Flex align='center'>
        <SectionTitle>Mode</SectionTitle>
        <ToggleButtonGroup
          options={modeOptions}
          value={mode}
          onChange={onModeChange}
          ariaLabelPrefix="Mode"
        />
      </Flex>

      <DitheringSelector />

      <ProcessorSelector />

      <ContrastStrategySelector />

      <Flex align='center'>
        <SectionTitle>Espace de couleur</SectionTitle>
        <ToggleButtonGroup
          options={colorSpaceOptions}
          value={colorSpace}
          onChange={onColorSpaceChange}
          ariaLabelPrefix="ColorSpace"
        />
      </Flex>
    </div>
  )
}
