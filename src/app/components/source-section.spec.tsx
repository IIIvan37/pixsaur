import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setImgAtom } from '@/app/store/image/image'
import { pickImageFileTauriAsFile } from '@/components/image-upload/tauri-file-picker'
import { processImageFile } from '@/components/image-upload/utils'
import { isTauri } from '@/utils/is-tauri'
import { mockGlobalImage, renderWithProviders } from '@/utils/test-utils'
import SourceSection from './source-section'

vi.mock('@/utils/is-tauri')
vi.mock('@/components/image-upload/tauri-file-picker')
vi.mock('@/components/image-upload/utils')
vi.mock('@tauri-apps/api/window', () => ({
  // Provide a lightweight stub implementation of Window.getByLabel so
  // tests running in JSDOM won't call Tauri internals which rely on
  // `invoke`. The returned object exposes `listen` and
  // `onDragDropEvent` methods used by the component.
  Window: {
    getByLabel: vi.fn(async (_label: string) => ({
      listen: vi.fn(),
      onDragDropEvent: vi.fn()
    }))
  }
}))

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
    const { findByTestId } = renderWithProviders(<SetupInitialImage />)

    const changeButton = screen.getByRole('button', {
      name: /Changer d'image/i
    })
    await userEvent.click(changeButton)

    // The upload input should now exist
    await findByTestId('image-upload-input')

    // The previous image should have been cleared
    expect(document.querySelector('canvas')).toBeNull()
  })

  it("on Tauri, clicking 'Changer d'image' opens native picker and loads image", async () => {
    // Make the app think we are running inside Tauri
    vi.mocked(isTauri as any).mockReturnValue(true)

    // Mock native file picker to return a File
    const file = new File([new ArrayBuffer(1)], 'tauri.png', {
      type: 'image/png'
    })
    vi.mocked(pickImageFileTauriAsFile as any).mockResolvedValue(file)

    // Use the existing Image loader to produce an HTMLImageElement
    const toReturn = new Image()
    toReturn.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+JfHqAAAAAElFTkSuQmCC'
    vi.mocked(processImageFile as any).mockResolvedValue(toReturn)

    const { findByTestId } = renderWithProviders(<SourceSection />)

    const changeButton = screen.getByRole('button', {
      name: /Changer d'image/i
    })

    await userEvent.click(changeButton)

    // ImageSelector should be mounted after image load
    await findByTestId('image-selector-container')
  })
})
