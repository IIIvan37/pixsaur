import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  addImageToDskAtom,
  dskImagesAtom,
  hasDskImagesAtom,
  removeImageFromDskAtom
} from '@/app/store/dsk-workspace/dsk-workspace'
import type { CPCHardware } from '@/libs/types'
import {
  calculateDskRemainingSpace,
  canAddImageToDsk,
  formatDskSpace
} from './dsk-workspace-utils'
import { DskWorkspaceView } from './dsk-workspace-view'

interface DskWorkspaceProps {
  readonly onExport: () => void
  readonly currentImageData?: {
    readonly name: string
    readonly scrData: Uint8Array
    readonly mode: 0 | 1 | 2
    readonly width: number
    readonly height: number
    readonly overscan: boolean
    nColors: number
    scaleX: number
    scaleY: number
    cpcHardware: CPCHardware
    paletteFirmware: number[]
    palettePlus?: number[]
    thumbnailDataUrl?: string
    paletteColors?: string[]
  }
  canAddCurrentImage: boolean
}

export default function DskWorkspace({
  onExport,
  currentImageData,
  canAddCurrentImage
}: Readonly<DskWorkspaceProps>) {
  const { _ } = useLingui()
  const images = useAtomValue(dskImagesAtom)
  const hasImages = useAtomValue(hasDskImagesAtom)
  const addImageToDsk = useSetAtom(addImageToDskAtom)
  const removeImageFromDsk = useSetAtom(removeImageFromDskAtom)

  // Check if there is enough space on DSK for a new image
  const hasEnoughSpace = canAddImageToDsk(
    images,
    currentImageData
      ? {
          width: currentImageData.width,
          height: currentImageData.height,
          mode: currentImageData.mode,
          overscan: currentImageData.overscan
        }
      : undefined
  )
  const canAdd = canAddCurrentImage && hasEnoughSpace

  const handleAddCurrentImage = () => {
    if (currentImageData) {
      addImageToDsk(currentImageData)
    }
  }

  // Determine button title based on state
  let addButtonTitle: string
  if (canAddCurrentImage && hasEnoughSpace) {
    addButtonTitle = _(msg`Add current converted image to DSK workspace`)
  } else if (hasEnoughSpace) {
    addButtonTitle = _(msg`No image to add`)
  } else {
    addButtonTitle = _(msg`Not enough space on DSK`)
  }

  const remainingSpace = formatDskSpace(calculateDskRemainingSpace(images))

  const getColorTitle = (index: number, color: string) =>
    _(msg`Color ${index}: ${color}`)

  const getRemoveImageTitle = () => _(msg`Remove image from workspace`)

  return (
    <DskWorkspaceView
      images={images}
      hasImages={hasImages}
      canAddCurrentImage={canAdd}
      addButtonTitle={addButtonTitle}
      remainingSpace={remainingSpace}
      onAddCurrentImage={handleAddCurrentImage}
      onRemoveImage={removeImageFromDsk}
      onExport={onExport}
      getColorTitle={getColorTitle}
      getRemoveImageTitle={getRemoveImageTitle}
    />
  )
}
