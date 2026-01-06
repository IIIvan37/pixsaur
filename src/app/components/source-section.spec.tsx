import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setImgAtom } from '@/app/store/image/image'
import { processImageFile } from '@/components/image-upload/utils'
import { isTauri, pickImageFileTauriAsFile } from '@/tauri'
import { mockGlobalImage, renderWithProviders } from '@/test-utils'
import SourceSection from './source-section'

vi.mock('@/tauri')
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

function SetupInitialImage({ onReady }: { onReady?: () => void }) {
  const setImg = useSetAtom(setImgAtom)
  useEffect(() => {
    // mock a data URL image
    const img = new Image()
    img.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+JfHqAAAAAElFTkSuQmCC'
    setImg(img)
    onReady?.()
  }, [setImg, onReady])
  return <SourceSection />
}

describe('SourceSection', () => {
  beforeEach(() => {
    mockGlobalImage()
    vi.mocked(processImageFile as any).mockClear()
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

  it('dropping an image file processes and loads it', async () => {
    // Mock processImageFile to return a new image
    const newImage = new Image()
    newImage.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+JfHqAAAAAElFTkSuQmCC'
    vi.mocked(processImageFile as any).mockResolvedValue(newImage)

    const { findByTestId } = renderWithProviders(<SourceSection />)

    // When there's no image, the upload dropzone is shown
    const uploadDropzone = await findByTestId('image-upload-dropzone')

    // Create a mock file to drop
    const file = new File(['dummy content'], 'test-image.png', {
      type: 'image/png'
    })

    // Simulate drop event on the upload dropzone
    const dataTransfer = {
      files: [file],
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        }
      ],
      types: ['Files']
    }

    fireEvent.drop(uploadDropzone, { dataTransfer })

    // processImageFile should have been called with the dropped file
    await waitFor(() => {
      expect(processImageFile).toHaveBeenCalledWith(file)
    })

    // After loading, the ImageSelector should be displayed
    await findByTestId('image-selector-container', undefined, { timeout: 2000 })
  })

  it('does not process non-image files when dropped', async () => {
    const { findByTestId } = renderWithProviders(<SourceSection />)

    // When there's no image, the upload dropzone is shown
    const uploadDropzone = await findByTestId('image-upload-dropzone')

    // Create a non-image file
    const file = new File(['dummy content'], 'document.txt', {
      type: 'text/plain'
    })

    const dataTransfer = {
      files: [file],
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file
        }
      ],
      types: ['Files']
    }

    fireEvent.drop(uploadDropzone, { dataTransfer })

    // processImageFile should NOT have been called for non-image files
    // Small delay to allow any async handlers to complete
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(processImageFile).not.toHaveBeenCalled()
  })
})
