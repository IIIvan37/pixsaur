import { useAtomValue, useSetAtom } from 'jotai'
import {
  colorSpaceAtom,
  ditheringAtom,
  modeAtom,
  setColorSpaceAtom,
  setDitheringAtom,
  setModeAtom
} from '@/app/store/config/config'
import { ImageControlsView } from './image-controls-view'

/**
 * ImageControls is a container component that connects Jotai atoms for image configuration
 * (mode, dithering, and color space) to the presentational ImageControlsView component.
 *
 * It retrieves the current values and setter functions for each configuration option from the store,
 * and passes them as props to ImageControlsView.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageControlsView with state and handlers injected.
 */
export default function ImageControls() {
  const mode = useAtomValue(modeAtom)

  const dithering = useAtomValue(ditheringAtom)
  const onDitheringChange = useSetAtom(setDitheringAtom)
  const onModeChange = useSetAtom(setModeAtom)
  const colorSpace = useAtomValue(colorSpaceAtom)
  const onColorSpaceChange = useSetAtom(setColorSpaceAtom)
  return (
    <ImageControlsView
      mode={mode}
      onModeChange={onModeChange}
      dithering={dithering}
      onDitheringChange={onDitheringChange}
      colorSpace={colorSpace}
      onColorSpaceChange={onColorSpaceChange}
    />
  )
}
