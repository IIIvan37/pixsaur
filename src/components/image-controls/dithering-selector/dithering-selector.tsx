import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
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
import { rasterTuningEnabledAtom } from '@/app/store/raster/raster-tuning'
import { useAutoRegenerateRasters } from '@/app/store/raster/use-auto-regenerate-rasters'
import Button from '@/components/ui/button'
import Flex from '@/components/ui/flex'
import Icon from '@/components/ui/icon'
import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { isDevelopment } from '@/core'
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

export function DitheringSelector({
  rasterEnabled: rasterEnabledProp,
  onRasterEnabledChange
}: {
  rasterEnabled?: boolean
  onRasterEnabledChange?: (enabled: boolean) => void
} = {}) {
  const [cfg, setCfg] = useAtom(ditheringAtom)
  const [rasterEnabledAtomValue, setRasterEnabledAtom] =
    useAtom(rasterEnabledAtom)
  const rasterEnabled = rasterEnabledProp ?? rasterEnabledAtomValue
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
  const tuningEnabled = useAtomValue(rasterTuningEnabledAtom)

  // Auto-regenerate rasters when parameters change (if already generated)
  useAutoRegenerateRasters()

  // Maximum changes per line depends on:
  // - Hardware: CPC Plus can do 4 changes/line, Classic can do 2
  // - Mode 2: only 2 inks available, so max 2 changes regardless of hardware
  const hardwareMax = cpcHardware === 'plus' ? 4 : 2
  const maxAllowedChanges = Math.min(modeConfig.nColors, hardwareMax)
  const hasImage = image !== null

  // Automatically clamp maxChangesPerLine if it exceeds hardware limits
  // This handles localStorage values from previous sessions with different hardware
  useEffect(() => {
    if (maxChangesPerLine > maxAllowedChanges) {
      setMaxChangesPerLine(maxAllowedChanges)
    }
  }, [maxChangesPerLine, maxAllowedChanges, setMaxChangesPerLine])

  // When raster is enabled, switch to a compatible dithering mode if current mode is incompatible
  useEffect(() => {
    if (rasterEnabled) {
      if (
        cfg.mode === 'floydSteinberg' ||
        cfg.mode === 'atkinson' ||
        cfg.mode === 'ylioluma1' ||
        cfg.mode === 'ylioluma2'
      ) {
        // Switch to bayer2x2 as default compatible mode
        setCfg({
          mode: 'bayer2x2',
          intensity: getDefaultIntensity('bayer2x2')
        })
      }
    }
  }, [rasterEnabled, cfg.mode, setCfg])

  const handleAutoOptimize = async () => {
    if (isOptimizing) return // Prevent multiple clicks
    setIsOptimizing(true)
    try {
      await autoOptimize()
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleRasterEnabledChange =
    onRasterEnabledChange ?? setRasterEnabledAtom
  const rasterEnabledId = 'raster-enabled-switch'

  // Filter modes based on raster state
  // When raster is enabled, exclude error-diffusion algorithms that don't work well with dynamic palettes
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
      {/* Switch Mode Raster - toujours visible */}
      <Flex align='center' justify='space-between' style={{ width: '100%' }}>
        <div
          style={{
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--color-foreground)'
          }}
        >
          <Trans>Mode Raster</Trans>
        </div>
        <Switch
          checked={rasterEnabled}
          onCheckedChange={handleRasterEnabledChange}
          id={rasterEnabledId}
        />
      </Flex>

      {/* Sliders et bouton - visible seulement si raster activé */}
      {rasterEnabled && (
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
                    Dithering horizontal 1D appliqué lors du prétraitement
                    raster
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
              disabled={
                isOptimizing ||
                (hasGeneratedRasters && !(isDevelopment() && tuningEnabled))
              }
            >
              <Icon name='GearIcon' />
              {isOptimizing ? (
                <Trans>Optimisation...</Trans>
              ) : hasGeneratedRasters ? (
                isDevelopment() && tuningEnabled ? (
                  <Trans>Régénérer les rasters</Trans>
                ) : (
                  <Trans>Rasters générés</Trans>
                )
              ) : (
                <Trans>Générer les rasters</Trans>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Mode dithering final - toujours visible */}
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
    </>
  )
}
