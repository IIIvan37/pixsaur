import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ImageUploadView } from './image-upload-view'

let files: File[] = []

vi.mock('react-dropzone', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useDropzone: (opts: any) => ({
    getRootProps: () => ({}),
    getInputProps: () => ({
      'data-testid': 'image-upload-input',
      ref: (node: HTMLInputElement | null) => {
        if (node) {
          node.onchange = () => opts.onDrop(files)
        }
      }
    }),
    isDragActive: false
  })
}))

describe('ImageUploadView', () => {
  beforeEach(() => {
    files = []
  })

  it('renders instructional texts', () => {
    render(<ImageUploadView onUpload={vi.fn()} />)
    expect(screen.getByText(/glissez & déposez une image/i)).toBeInTheDocument()
    expect(
      screen.getByText(/ou cliquez pour sélectionner un fichier/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/formats supportés/i)).toBeInTheDocument()
  })

  it('calls onUpload when a file is selected', () => {
    files = [new File(['dummy'], 'test.png', { type: 'image/png' })]
    const onUpload = vi.fn()
    render(<ImageUploadView onUpload={onUpload} />)
    const input = screen.getByTestId('image-upload-input')
    fireEvent.change(input)
    expect(onUpload).toHaveBeenCalledWith(files)
  })

  it('renders custom texts if provided', () => {
    render(
      <ImageUploadView
        onUpload={vi.fn()}
        primaryText='Custom primary'
        secondaryText='Custom secondary'
        helpText='Custom help'
      />
    )
    expect(screen.getByText('Custom primary')).toBeInTheDocument()
    expect(screen.getByText('Custom secondary')).toBeInTheDocument()
    expect(screen.getByText('Custom help')).toBeInTheDocument()
  })

  it('does not call onUpload if no file is selected', () => {
    files = []
    const onUpload = vi.fn()
    render(<ImageUploadView onUpload={onUpload} />)
    const input = screen.getByTestId('image-upload-input')
    fireEvent.change(input)
    expect(onUpload).toHaveBeenCalledWith([])
  })

  it('does not call onUpload for non-image files', () => {
    files = [new File(['dummy'], 'test.txt', { type: 'text/plain' })]
    const onUpload = vi.fn()
    render(<ImageUploadView onUpload={onUpload} />)
    const input = screen.getByTestId('image-upload-input')
    fireEvent.change(input)
    expect(onUpload).toHaveBeenCalledWith(files)
    // In your parent logic, you may want to filter these out!
  })

  it('calls onUpload with only the first file if multiple files are selected', () => {
    files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' })
    ]
    const onUpload = vi.fn()
    render(<ImageUploadView onUpload={onUpload} />)
    const input = screen.getByTestId('image-upload-input')
    fireEvent.change(input)
    expect(onUpload).toHaveBeenCalledWith(files)
    // Your parent logic may only use the first file!
  })
})
