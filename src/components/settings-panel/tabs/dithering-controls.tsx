/**
 * Simplified dithering controls for Settings panel
 * Contains only: raster switch, dithering mode selection, and intensity
 * Raster-specific controls (max changes, raster dithering) are in RasterTab
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { ditheringAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import type { DitheringMode } from '@/libs/pixsaur-color/src'

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
 */
export function getDefaultIntensity(mode: DitheringMode): number {
  switch (mode) {
    case 'floydSteinberg':
      return 0.5
    case 'atkinson':
      return 0.5
    case 'bayer2x2':
      return 0.25
    case 'bayer4x4':
      return 0.25
    case 'bayer8x8':
      return 0.25
    case 'halftone4x4':
      return 0.08
    case 'ylioluma1':
      return 0.16
    case 'ylioluma2':
      return 1
    default:
      return 0.5
  }
}

export function DitheringControls() {
  const [cfg, setCfg] = useAtom(ditheringAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)

  // Filter modes for raster (exclude error diffusion algorithms)
  const availableModes = rasterEnabled
    ? MODES.filter(
        (mode) =>
          mode.value !== 'floydSteinberg' &&
          mode.value !== 'atkinson' &&
          mode.value !== 'ylioluma1' &&
          mode.value !== 'ylioluma2'
      )
    : MODES

  return (
    <>
      {/* Mode dithering final */}
      <Flex
        gap='var(--spacing-md)'
        wrap='wrap'
        justify='flex-start'
        align='flex-start'
      >
        <Flex direction='column' gap='var(--spacing-xs)' align='flex-start'>
          <div
            style={{
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-foreground)'
            }}
          >
            <Trans>Dithering final</Trans>
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
            {availableModes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </Select>
        </Flex>

        <div style={{ minWidth: '200px', flex: 1 }}>
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
    </>
  )
}
