import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import {
  cpcHardwareAtom,
  ditheringAtom,
  effectiveModeConfigAtom
} from '@/app/store/config/config'
import { imageAtom } from '@/app/store/image/image'
import {
  autoOptimizeRasterAtom,
  hasGeneratedRastersAtom,
  rasterDitheringIntensityAtom,
  rasterEnabledAtom,
  rasterMaxChangesPerLineAtom
} from '@/app/store/raster/raster'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
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
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const image = useAtomValue(imageAtom)
  const hasGeneratedRasters = useAtomValue(hasGeneratedRastersAtom)
  const [rasterDitheringIntensity, setRasterDitheringIntensity] = useAtom(
    rasterDitheringIntensityAtom
  )
  const [maxChangesPerLine, setMaxChangesPerLine] = useAtom(
    rasterMaxChangesPerLineAtom
  )
  const autoOptimize = useSetAtom(autoOptimizeRasterAtom)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Maximum changes per line depends on:
  // - Hardware: CPC Plus can do 4 changes/line, Classic can do 2
  // - Mode 2: only 2 inks available, so max 2 changes regardless of hardware
  const hardwareMax = cpcHardware === 'plus' ? 4 : 2
  const maxAllowedChanges = Math.min(modeConfig.nColors, hardwareMax)
  const hasImage = image !== null

  const handleAutoOptimize = async () => {
    if (isOptimizing) return // Prevent multiple clicks
    setIsOptimizing(true)
    try {
      await autoOptimize()
    } finally {
      setIsOptimizing(false)
    }
  }

  // Show raster dithering slider when raster mode is enabled
  if (rasterEnabled) {
    return (
      <div className={styles.slidersRow}>
        <div className={styles.slidersGroup}>
          <div className={styles.ditheringSlider}>
            <PixsaurSlider
              label={<Trans>Changements par ligne</Trans>}
              description={
                <Trans>
                  Nombre maximum de changements d'encre par ligne (1 = raster
                  classique)
                </Trans>
              }
              min={1}
              max={maxAllowedChanges}
              value={Math.min(maxChangesPerLine, maxAllowedChanges)}
              onChange={setMaxChangesPerLine}
              step={1}
            />
          </div>
          <div className={styles.ditheringSlider}>
            <PixsaurSlider
              label={<Trans>Dithering raster</Trans>}
              description={
                <Trans>
                  Dithering horizontal 1D appliqué lors du prétraitement raster
                </Trans>
              }
              min={0}
              max={100}
              value={Math.round(rasterDitheringIntensity * 100)}
              onChange={(val) => setRasterDitheringIntensity(val / 100)}
              step={5}
            />
          </div>
        </div>
        {hasImage && (
          <Button
            variant='secondary'
            onClick={handleAutoOptimize}
            disabled={isOptimizing || hasGeneratedRasters}
          >
            <Icon name='GearIcon' />
            {isOptimizing ? (
              <Trans>Optimisation...</Trans>
            ) : hasGeneratedRasters ? (
              <Trans>Rasters générés</Trans>
            ) : (
              <Trans>Générer les rasters</Trans>
            )}
          </Button>
        )}
      </div>
    )
  }

  return (
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
