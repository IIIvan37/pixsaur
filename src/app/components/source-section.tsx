import { ImageUpload } from '@/components/image-upload/image-upload'

import { ImageSelector } from '@/components/image-selector'

import { imageAtom, setImgAtom, setSelectionAtom } from '../store/image/image'
import { useAtomValue, useSetAtom } from 'jotai'
import { resetImageAdjustmentsAtom } from '../store/config/config'

import { Panel } from '@/components/ui/layout/panel/panel'
import { Header } from '@/components/ui/layout/header/header'

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
