import { ImageControlsView } from './image-controls-view'

/**
 * ImageControls is a simplified container component that provides
 * processor selection only.
 * Palette strategy, dithering, hardware, dimensions, and image adjustments are now in the Settings panel.
 *
 * @component
 * @returns {JSX.Element} The rendered ImageControlsView.
 */
export default function ImageControls() {
  return <ImageControlsView />
}
