/**
 * Simplified dithering controls for Settings panel
 * Contains only: raster switch, dithering mode selection, and intensity
 * Raster-specific controls (max changes, raster dithering) are in RasterTab
 */

import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { ditheringAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import {
  ALL_DITHERING_MODES,
  getDefaultDitheringIntensity,
  getRasterCompatibleModes,
  isRasterCompatibleMode
} from '@/components/settings-panel/shared/dithering-modes'
import Flex from '@/components/ui/flex'
import { Select, SelectItem } from '@/components/ui/select'
import PixsaurSlider from '@/components/ui/slider'
import type { DitheringMode } from '@/libs/pixsaur-color/src'

export function DitheringControls() {
  const [cfg, setCfg] = useAtom(ditheringAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)

  // When raster is enabled, switch to a compatible dithering mode if current mode is incompatible
  useEffect(() => {
    if (
      rasterEnabled &&
      cfg.mode !== 'none' &&
      !isRasterCompatibleMode(cfg.mode)
    ) {
      // Switch to bayer2x2 as default compatible mode
      setCfg({
        mode: 'bayer2x2',
        intensity: getDefaultDitheringIntensity('bayer2x2')
      })
    }
  }, [rasterEnabled, cfg.mode, setCfg])

  // Filter modes for raster (exclude error diffusion algorithms)
  const availableModes = rasterEnabled
    ? getRasterCompatibleModes()
    : ALL_DITHERING_MODES

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
                intensity: getDefaultDitheringIntensity(newMode)
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
