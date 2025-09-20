import { useAtomValue, useSetAtom } from 'jotai'
import {
  cpcHardwareAtom,
  modeAtom,
  setCpcHardwareAtom,
  setModeAtom
} from '@/app/store/config/config'
import { ImageControlsView } from './image-controls-view'

/**
 * ImageControls is a container component that connects Jotai atoms for image configuration
 * (mode and hardware) to the presentational ImageControlsView component.
 * ColorSpace is now fixed to RGB for optimal GPU performance.
 *
 * It retrieves the current values and setter functions for each configuration option from the store,
 * and passes them as props to ImageControlsView.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageControlsView with state and handlers injected.
 */
export default function ImageControls() {
  const mode = useAtomValue(modeAtom)
  const onModeChange = useSetAtom(setModeAtom)
  const cpcHardware = useAtomValue(cpcHardwareAtom)
  const onCpcHardwareChange = useSetAtom(setCpcHardwareAtom)
  return (
    <ImageControlsView
      mode={mode}
      onModeChange={onModeChange}
      cpcHardware={cpcHardware}
      onCpcHardwareChange={onCpcHardwareChange}
    />
  )
}
