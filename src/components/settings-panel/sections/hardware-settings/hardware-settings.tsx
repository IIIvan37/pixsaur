/**
 * Hardware settings component (smart component with hooks)
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  dimensionPresetAtom,
  modeREnabledAtom,
  pixelModeAtom,
  setCpcHardwareAtom,
  setDimensionPresetAtom,
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
  const setRasterEnabled = useSetAtom(rasterEnabledAtom)

  // When Mode R is enabled, force Mode 0 and disable Raster (mutually exclusive)
  const handleModeRChange = (enabled: boolean) => {
    setModeREnabled(enabled)
    if (enabled) {
      if (pixelMode !== 0) {
        setPixelMode(0)
      }
      // Mode R and Raster are mutually exclusive
      setRasterEnabled(false)
    }
  }

  return (
    <HardwareSettingsView
      cpcHardware={cpcHardware}
      onCpcHardwareChange={setCpcHardware}
      pixelMode={pixelMode}
      onPixelModeChange={setPixelMode}
      dimensionPreset={dimensionPreset}
      onDimensionPresetChange={setDimensionPreset}
      modeREnabled={modeREnabled}
      onModeREnabledChange={handleModeRChange}
    />
  )
}
