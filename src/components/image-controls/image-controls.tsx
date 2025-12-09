import { useAtom } from 'jotai'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import { ImageControlsView } from './image-controls-view'

/**
 * ImageControls is a simplified container component that provides
 * palette selection, dithering/raster configuration, and processor selection.
 * Hardware, dimensions, and image adjustments are now in the Settings panel.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageControlsView with state and handlers injected.
 */
export default function ImageControls() {
  const [rasterEnabled, setRasterEnabled] = useAtom(rasterEnabledAtom)

  return (
    <ImageControlsView
      rasterEnabled={rasterEnabled}
      onRasterEnabledChange={setRasterEnabled}
    />
  )
}
