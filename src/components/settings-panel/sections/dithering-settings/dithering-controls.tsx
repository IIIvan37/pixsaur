/**
 * Simplified dithering controls for Settings panel
 * Contains only: raster switch, dithering mode selection, and intensity
 * Raster-specific controls (max changes, raster dithering) are in RasterTab
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useId } from 'react'
import { ditheringAtom, egxEnabledAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import {
  ALL_DITHERING_MODES,
  getDefaultDitheringIntensity,
  getEGXCompatibleModes,
  getMaxDitheringIntensity,
  getRasterCompatibleModes,
  isEGXCompatibleMode,
  isRasterCompatibleMode
} from '@/components/settings-panel/shared/dithering-modes'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { DitheringMode } from '@/libs/pixsaur-color/src'

type DitheringControlsProps = Readonly<{
  disabled?: boolean
}>

export function DitheringControls({
  disabled = false
}: DitheringControlsProps) {
  const [cfg, setCfg] = useAtom(ditheringAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)
  const egxEnabled = useAtomValue(egxEnabledAtom)
  const correctionSwitchId = useId()
  const orderedCorrectionSwitchId = useId()

  // When raster is enabled, switch to a compatible dithering mode if current mode is incompatible
  useEffect(() => {
    if (
      rasterEnabled &&
      cfg.mode !== 'none' &&
      !isRasterCompatibleMode(cfg.mode)
    ) {
      // Switch to bayer2x2 as default compatible mode
      setCfg({
        ...cfg,
        mode: 'bayer2x2',
        intensity: getDefaultDitheringIntensity('bayer2x2')
      })
    }
  }, [rasterEnabled, cfg, setCfg])

  // When EGX is enabled, switch to a compatible mode if current mode is not supported
  useEffect(() => {
    if (egxEnabled && cfg.mode !== 'none' && !isEGXCompatibleMode(cfg.mode)) {
      // Switch to floydSteinberg as default EGX mode
      setCfg({
        ...cfg,
        mode: 'floydSteinberg',
        intensity: getDefaultDitheringIntensity('floydSteinberg')
      })
    }
  }, [egxEnabled, cfg, setCfg])

  const showCorrectionSwitch =
    cfg.mode === 'floydSteinberg' ||
    cfg.mode === 'atkinson' ||
    cfg.mode === 'ostromoukhov'

  const showOrderedCorrectionSwitch =
    cfg.mode === 'bayer2x2' ||
    cfg.mode === 'bayer4x4' ||
    cfg.mode === 'bayer8x8' ||
    cfg.mode === 'halftone4x4' ||
    cfg.mode === 'blueNoise'

  // Filter modes based on active features
  const getAvailableModes = () => {
    if (rasterEnabled) return getRasterCompatibleModes()
    if (egxEnabled) return getEGXCompatibleModes()
    return ALL_DITHERING_MODES
  }
  const availableModes = getAvailableModes()

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
                ...cfg,
                mode: newMode,
                intensity: getDefaultDitheringIntensity(newMode)
              })
            }}
            disabled={disabled}
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
            max={Math.round(getMaxDitheringIntensity(cfg.mode) * 100)}
            value={Math.round(cfg.intensity * 100)}
            onChange={(val) => setCfg({ ...cfg, intensity: val / 100 })}
            step={1}
            disabled={disabled || cfg.mode === 'ylioluma2'}
          />

          {showCorrectionSwitch && (
            <Flex direction='row' gap='0.5rem' align='center'>
              <Switch
                checked={cfg.useDiffusionCorrection ?? true}
                onCheckedChange={(value) =>
                  setCfg({ ...cfg, useDiffusionCorrection: value })
                }
                disabled={disabled}
                id={correctionSwitchId}
              />
              <label htmlFor={correctionSwitchId}>
                <Trans>Correction diffusion (anti-bavure)</Trans>
              </label>
            </Flex>
          )}

          {showOrderedCorrectionSwitch && (
            <Flex direction='row' gap='0.5rem' align='center'>
              <Switch
                checked={cfg.useOrderedCorrection ?? true}
                onCheckedChange={(value) =>
                  setCfg({ ...cfg, useOrderedCorrection: value })
                }
                disabled={disabled}
                id={orderedCorrectionSwitchId}
              />
              <label htmlFor={orderedCorrectionSwitchId}>
                <Trans>
                  Correction ordonnée (amplitude adaptative + skip exact)
                </Trans>
              </label>
            </Flex>
          )}
        </div>
      </Flex>
    </>
  )
}
