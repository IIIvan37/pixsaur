import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { ditheringAtom } from '@/app/store/config/config'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import type { DitheringMode } from '@/libs/pixsaur-color/src'
import styles from './dithering-selector.module.css'

type DitheringModeOption = {
  value: DitheringMode
  label: string
}

const MODES: readonly DitheringModeOption[] = [
  { value: 'floydSteinberg', label: 'Floyd–Steinberg' },
  { value: 'bayer2x2', label: 'Bayer 2x2' },
  { value: 'bayer4x4', label: 'Bayer 4x4' },
  { value: 'bayer8x8', label: 'bayer 8x8' },
  { value: 'ylioluma1', label: 'Ylioluma 1' },
  { value: 'ylioluma2', label: 'Ylioluma 2' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'halftone4x4', label: 'Halftone 4x4' }
]

/**
 * Returns the default intensity for a given dithering mode.
 * Values determined empirically through testing for optimal visual results.
 */
export function getDefaultIntensity(mode: DitheringMode): number {
  switch (mode) {
    case 'floydSteinberg':
      return 0.5 // Balanced error diffusion
    case 'atkinson':
      return 0.5 // Balanced error diffusion
    case 'bayer2x2':
      return 0.25 // Optimal for 2x2 ordered dithering
    case 'bayer4x4':
      return 0.25 // Optimal for 4x4 ordered dithering
    case 'bayer8x8':
      return 0.25 // Optimal for 8x8 ordered dithering
    case 'halftone4x4':
      return 0.08 // Balanced for halftone simulation
    case 'ylioluma1':
      return 0.16 // Optimal for Ylioluma 1 algorithm
    case 'ylioluma2':
      return 1 // Maximum intensity
    default:
      return 0.5
  }
}

export function DitheringSelector() {
  const [cfg, setCfg] = useAtom(ditheringAtom)

  return (
    <Flex
      gap='var(--spacing-md)'
      wrap='wrap'
      justify='flex-start'
      align='flex-start'
    >
      <Flex direction='column' gap='var(--spacing-xs)' align='start'>
        <div
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-foreground)'
          }}
        >
          <Trans>Mode de dithering</Trans>
        </div>
        <Select
          value={cfg.mode}
          onValueChange={(value) => {
            const newMode = value as DitheringMode
            setCfg({
              mode: newMode,
              intensity: getDefaultIntensity(newMode)
            })
          }}
        >
          {MODES.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>
              {mode.label}
            </SelectItem>
          ))}
        </Select>
      </Flex>

      <div className={styles.ditheringSlider}>
        <PixsaurSlider
          label={<Trans>Intensité</Trans>}
          min={0}
          max={100}
          value={Math.round(cfg.intensity * 100)}
          onChange={(val) => setCfg({ ...cfg, intensity: val / 100 })}
          step={1}
          disabled={cfg.mode === 'ylioluma2'}
        />
      </div>
    </Flex>
  )
}
