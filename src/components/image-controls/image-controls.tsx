import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  dimensionPresetAtom,
  horizontalSmoothingAtom,
  pixelModeAtom,
  setCpcHardwareAtom,
  setDimensionPresetAtom,
  setPixelModeAtom
} from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { ImageControlsView } from './image-controls-view'

/**
 * ImageControls is a container component that connects Jotai atoms for image configuration
 * (pixel mode, dimension preset, and hardware) to the presentational ImageControlsView component.
 * ColorSpace is now fixed to RGB for optimal GPU performance.
 *
 * It retrieves the current values and setter functions for each configuration option from the store,
 * and passes them as props to ImageControlsView.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageControlsView with state and handlers injected.
 */
export default function ImageControls() {
  const pixelMode = useAtomValue(pixelModeAtom)
  const onPixelModeChange = useSetAtom(setPixelModeAtom)
  const dimensionPreset = useAtomValue(dimensionPresetAtom)
  const onDimensionPresetChange = useSetAtom(setDimensionPresetAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const onCpcHardwareChange = useSetAtom(setCpcHardwareAtom)
  const [horizontalSmoothing, setHorizontalSmoothing] = useAtom(
    horizontalSmoothingAtom
  )
  const [rasterEnabled, setRasterEnabled] = useAtom(rasterEnabledAtom)

  return (
    <ImageControlsView
      pixelMode={pixelMode}
      onPixelModeChange={onPixelModeChange}
      dimensionPreset={dimensionPreset}
      onDimensionPresetChange={onDimensionPresetChange}
      cpcHardware={cpcHardware}
      onCpcHardwareChange={onCpcHardwareChange}
      horizontalSmoothing={horizontalSmoothing}
      onHorizontalSmoothingChange={setHorizontalSmoothing}
      rasterEnabled={rasterEnabled}
      onRasterEnabledChange={setRasterEnabled}
    />
  )
}
