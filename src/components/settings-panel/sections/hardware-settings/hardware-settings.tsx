/**
 * Hardware settings component (smart component with hooks)
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  dimensionPresetAtom,
  egxEnabledAtom,
  modeREnabledAtom,
  pixelModeAtom,
  setCpcHardwareAtom,
  setDimensionPresetAtom,
  setEgxEnabledAtom,
  setPixelModeAtom
} from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster-config'
import { HardwareSettingsView } from './hardware-settings-view'

export function HardwareSettings() {
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const setCpcHardware = useSetAtom(setCpcHardwareAtom)
  const pixelMode = useAtomValue(pixelModeAtom)
  const setPixelMode = useSetAtom(setPixelModeAtom)
  const dimensionPreset = useAtomValue(dimensionPresetAtom)
  const setDimensionPreset = useSetAtom(setDimensionPresetAtom)
  const modeREnabled = useAtomValue(modeREnabledAtom)
  const setModeREnabled = useSetAtom(modeREnabledAtom)
  const egxEnabled = useAtomValue(egxEnabledAtom)
  const setEgxEnabled = useSetAtom(setEgxEnabledAtom)
  const setRasterEnabled = useSetAtom(rasterEnabledAtom)

  // When Mode R is enabled, force Mode 0 and disable Raster/EGX (mutually exclusive)
  const handleModeRChange = (enabled: boolean) => {
    setModeREnabled(enabled)
    if (enabled) {
      if (pixelMode !== 0) {
        setPixelMode(0)
      }
      // Mode R, Raster, and EGX are mutually exclusive
      setRasterEnabled(false)
      setEgxEnabled(false)
    }
  }

  // When EGX is enabled, disable Mode R and Raster (mutually exclusive)
  const handleEgxChange = (enabled: boolean) => {
    setEgxEnabled(enabled)
    if (enabled) {
      // EGX, Mode R, and Raster are mutually exclusive
      setModeREnabled(false)
      setRasterEnabled(false)
    }
  }

  // When pixel mode changes, disable Mode R if not Mode 0
  const handlePixelModeChange = (mode: 0 | 1 | 2) => {
    setPixelMode(mode)
    // Mode R only works with Mode 0
    if (mode !== 0 && modeREnabled) {
      setModeREnabled(false)
    }
  }

  return (
    <HardwareSettingsView
      cpcHardware={cpcHardware}
      onCpcHardwareChange={setCpcHardware}
      pixelMode={pixelMode}
      onPixelModeChange={handlePixelModeChange}
      dimensionPreset={dimensionPreset}
      onDimensionPresetChange={setDimensionPreset}
      modeREnabled={modeREnabled}
      onModeREnabledChange={handleModeRChange}
      egxEnabled={egxEnabled}
      onEgxEnabledChange={handleEgxChange}
    />
  )
}
