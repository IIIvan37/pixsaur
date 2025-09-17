import { useAtomValue, useSetAtom } from 'jotai'

import { ImageSelector } from '@/components/image-selector'
import { ImageUpload } from '@/components/image-upload/image-upload'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
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
    <Panel>
      <Header
        title={'Image source'}
        actionLabel={"Changer d'image"}
        action={() => {
          resetAdjustments()
          setImg(null)
          setSelection(null)
        }}
        icon='UploadIcon'
      />

      {!img ? (
        <ImageUpload onImageLoaded={handleImageLoaded} />
      ) : (
        <ImageSelector />
      )}
    </Panel>
  )
}
