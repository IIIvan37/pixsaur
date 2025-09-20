import { CPC_MODE_CONFIG, type CpcModeKey } from '@/app/store/config/types'
import type { CPCHardware } from '@/libs/types'
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
  cpcHardware: CPCHardware
  onCpcHardwareChange: (hardware: CPCHardware) => void
}

/**
 * Renders the image controls UI, allowing users to select the image processing mode
 * and CPC hardware configuration. ColorSpace is now fixed to RGB for optimal GPU performance.
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
  cpcHardware,
  onCpcHardwareChange
}: Readonly<ImageControlsViewProps>) {
  // Préparer les options pour les groupes de boutons
  const modeOptions = Object.keys(CPC_MODE_CONFIG).map((key) => ({
    value: key as CpcModeKey,
    label: key
  }))

  const hardwareOptions: Array<{ value: CPCHardware; label: string }> = [
    { value: 'classic' as CPCHardware, label: 'CPC (27)' },
    { value: 'plus' as CPCHardware, label: 'CPC+ (4096)' }
  ]

  return (
    <div className={styles.controlsContainer}>
       <Flex align='center'>
        <SectionTitle>Hardware</SectionTitle>
        <ToggleButtonGroup
          options={hardwareOptions}
          value={cpcHardware}
          onChange={onCpcHardwareChange}
          ariaLabelPrefix='Hardware'
        />
      </Flex>

      <Flex align='center'>
        <SectionTitle>Mode</SectionTitle>
        <ToggleButtonGroup
          options={modeOptions}
          value={mode}
          onChange={onModeChange}
          ariaLabelPrefix='Mode'
        />
      </Flex>

     
      <DitheringSelector />

      <ProcessorSelector />

      <ContrastStrategySelector />
    </div>
  )
}
