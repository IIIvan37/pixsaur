import Slider from './ui/slider'
import styles from '../styles/image-converter.module.css'
import animStyles from '../styles/animations.module.css'
import { Flex, Heading } from '@radix-ui/themes'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  colorSpaceAtom,
  ditheringAtom,
  modeAtom,
  setColorSpaceAtom,
  setDitheringAtom,
  setModeAtom
} from '@/app/store/config/config'
import { ColorSpace } from '@/libs/pixsaur-color/src/type'
import { CPC_MODE_CONFIG, CpcModeKey } from '@/app/store/config/types'

export default function ImageControls() {
  const mode = useAtomValue(modeAtom)

  const dithering = useAtomValue(ditheringAtom)
  const onDitheringChange = useSetAtom(setDitheringAtom)
  const onModeChange = useSetAtom(setModeAtom)
  const colorSpace = useAtomValue(colorSpaceAtom)
  const onColorSpaceChange = useSetAtom(setColorSpaceAtom)
  return (
    <div className={styles.controlsContainer}>
      <Flex justify='between' align='center' mb='2'>
        <Heading size='2' className={styles.sectionTitle}>
          Mode
        </Heading>
        <div className={styles.modeButtonsRow}>
          {Object.entries(CPC_MODE_CONFIG).map(([key, modeConfig]) => (
            <button
              key={`mode_${modeConfig.mode}`}
              className={`${styles.modeButton} ${animStyles.modeButton} ${
                mode === key
                  ? `${styles.modeButtonActive} ${animStyles.modeButtonActive}`
                  : `${styles.modeButtonInactive} ${animStyles.modeButtonInactive}`
              }`}
              onClick={() => onModeChange(key as CpcModeKey)}
              aria-label={`Mode ${key}`}
              aria-pressed={mode === key}
            >
              {key}
            </button>
          ))}
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
      <Flex justify='between' align='center' mb='2'>
        <Heading size='2' className={styles.sectionTitle}>
          Espace de couleur
        </Heading>
        <div className={styles.modeButtonsRow}>
          {['RGB', 'XYZ', 'Lab'].map((space) => (
            <button
              key={space}
              className={`${styles.modeButton} ${animStyles.modeButton} ${
                colorSpace === space
                  ? `${styles.modeButtonActive} ${animStyles.modeButtonActive}`
                  : `${styles.modeButtonInactive} ${animStyles.modeButtonInactive}`
              }`}
              onClick={() => onColorSpaceChange(space as ColorSpace)}
              aria-label={`ColorSpace ${space}`}
              aria-pressed={colorSpace === space}
            >
              {space}
            </button>
          ))}
        </div>
      </Flex>
    </div>
  )
}
