import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { ImageResizePanel } from '@/components/image-resize/image-resize-panel'
import { ImageSelector } from '@/components/image-selector'
import { ImageUpload } from '@/components/image-upload/image-upload'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { resetImageAdjustmentsAtom } from '../store/config/config'
import {
  imageAtom,
  setImgAtom,
  setOpenImagePickerAtom
} from '../store/image/image'

export default function SourceSection() {
  const setImg = useSetAtom(setImgAtom)
  // We intentionally don't reset selection when opening uploader
  const img = useAtomValue(imageAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const setOpenImagePicker = useSetAtom(setOpenImagePickerAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    setImg(img)
  }

  return (
    <Panel>
      <Header
        title={<Trans>Image source</Trans>}
        actionLabel={<Trans>Changer d'image</Trans>}
        action={() => {
          resetAdjustments()
          // Keep current image/selection and just open the uploader
          // so the user may choose a new file without losing the current image
          // unless they explicitly select a new one via the file picker.
          // Trigger the image picker as if the user clicked the uploader
          setOpenImagePicker(true)
        }}
        icon='UploadIcon'
      />

      {img ? (
        <>
          <ImageSelector />
          {/* Resize mode controls - placed after source selection */}
          <ImageResizePanel />
        </>
      ) : null}

      {/*
        Always mount the ImageUpload so we can programmatically open the
        file picker even when an image is already selected. When an image
        exists, keep the uploader hidden visually but mounted so it can
        respond to `setOpenImagePicker(true)`.
      */}
      <div style={{ display: img ? 'none' : 'block' }}>
        <ImageUpload onImageLoaded={handleImageLoaded} />
      </div>
    </Panel>
  )
}
