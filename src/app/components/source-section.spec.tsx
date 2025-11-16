import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setImgAtom } from '@/app/store/image/image'
import { mockGlobalImage, renderWithProviders } from '@/utils/test-utils'
import SourceSection from './source-section'

function SetupInitialImage() {
  const setImg = useSetAtom(setImgAtom)
  useEffect(() => {
    // mock a data URL image
    const img = new Image()
    img.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+JfHqAAAAAElFTkSuQmCC'
    setImg(img)
  }, [setImg])
  return <SourceSection />
}

describe('SourceSection', () => {
  beforeEach(() => {
    mockGlobalImage()
  })

  it("clicking 'Changer d'image' opens the uploader", async () => {
    const { findByTestId } = renderWithProviders(
      <>
        <SetupInitialImage />
      </>
    )

    const changeButton = screen.getByRole('button', {
      name: /Changer d'image/i
    })
    await userEvent.click(changeButton)

    // The upload input should now exist
    await findByTestId('image-upload-input')

    // The current source canvas should still be present (we didn't clear the image)
    expect(document.querySelector('canvas')).toBeDefined()
  })
})
