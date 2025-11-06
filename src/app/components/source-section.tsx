import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { ImageResizePanel } from '@/components/image-resize/image-resize-panel'
import { ImageSelector } from '@/components/image-selector'
import { ImageUpload } from '@/components/image-upload/image-upload'
import { CollapsibleSection } from '@/components/ui/collapsible-section/collapsible-section'
import { Header } from '@/components/ui/layout/header/header'
import { resetImageAdjustmentsAtom } from '../store/config/config'
import { imageAtom, setImgAtom, setSelectionAtom } from '../store/image/image'

export default function SourceSection() {
  const setImg = useSetAtom(setImgAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  const img = useAtomValue(imageAtom)

  const resetAdjustments = useSetAtom(resetImageAdjustmentsAtom)
  const handleImageLoaded = (img: HTMLImageElement) => {
    setImg(img)
  }

  return (
    <CollapsibleSection title={<Trans>Image source</Trans>} defaultOpen={true}>
      <Header
        actionLabel={<Trans>Changer d'image</Trans>}
        action={() => {
          resetAdjustments()
          setImg(null)
          setSelection(null)
        }}
        icon='UploadIcon'
      />

      {img ? (
        <>
          <ImageSelector />
          {/* Resize mode controls - placed after source selection */}
          <ImageResizePanel />
        </>
      ) : (
        <ImageUpload onImageLoaded={handleImageLoaded} />
      )}
    </CollapsibleSection>
  )
}
