import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DskImage } from '@/app/store/dsk-workspace/dsk-workspace'
import { renderWithI18n } from '@/utils/test-utils'
import { DskWorkspaceView } from './dsk-workspace-view'

// Mock child components
vi.mock('@/components/ui/button/button', () => ({
  default: ({
    children,
    onClick,
    disabled,
    title,
    variant,
    className
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    title?: string
    variant?: string
    className?: string
  }) => (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-variant={variant}
      className={className}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/icon', () => ({
  default: ({ name }: { name: string }) => <span data-icon={name}>{name}</span>
}))

vi.mock('@/components/ui/collapsible-section/collapsible-section', () => ({
  CollapsibleSection: ({
    children,
    title
  }: {
    children: React.ReactNode
    title: React.ReactNode
  }) => (
    <div data-testid='collapsible-section'>
      <div data-testid='section-title'>{title}</div>
      {children}
    </div>
  )
}))

describe('DskWorkspaceView', () => {
  const mockGetColorTitle = vi.fn(
    (index: number, color: string) => `Color ${index}: ${color}`
  )
  const mockGetRemoveImageTitle = vi.fn(() => 'Remove image')
  const mockOnAddCurrentImage = vi.fn()
  const mockOnRemoveImage = vi.fn()
  const mockOnExport = vi.fn()

  const defaultProps = {
    images: [],
    hasImages: false,
    canAddCurrentImage: false,
    addButtonTitle: 'Add image',
    remainingSpace: '178 KB',
    onAddCurrentImage: mockOnAddCurrentImage,
    onRemoveImage: mockOnRemoveImage,
    onExport: mockOnExport,
    getColorTitle: mockGetColorTitle,
    getRemoveImageTitle: mockGetRemoveImageTitle
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component', () => {
      renderWithI18n(<DskWorkspaceView {...defaultProps} />)
      expect(screen.getByTestId('collapsible-section')).toBeInTheDocument()
    })

    it('should render add button', () => {
      renderWithI18n(
        <DskWorkspaceView {...defaultProps} addButtonTitle='Custom title' />
      )
      const addButton = screen.getByTitle('Custom title')
      expect(addButton).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no images', () => {
      renderWithI18n(<DskWorkspaceView {...defaultProps} hasImages={false} />)
      // Check that there are no image thumbnails
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('should not show export button when empty', () => {
      renderWithI18n(<DskWorkspaceView {...defaultProps} hasImages={false} />)
      const exportButton = screen
        .queryAllByRole('button')
        .find((btn) => btn.getAttribute('data-variant') === 'primary')
      expect(exportButton).toBeUndefined()
    })
  })

  describe('Add Button', () => {
    it('should enable add button when canAddCurrentImage is true', () => {
      renderWithI18n(
        <DskWorkspaceView {...defaultProps} canAddCurrentImage={true} />
      )
      const addButton = screen.getByTitle('Add image')
      expect(addButton).not.toBeDisabled()
    })

    it('should disable add button when canAddCurrentImage is false', () => {
      renderWithI18n(
        <DskWorkspaceView {...defaultProps} canAddCurrentImage={false} />
      )
      const addButton = screen.getByTitle('Add image')
      expect(addButton).toBeDisabled()
    })

    it('should call onAddCurrentImage when clicked', async () => {
      const user = userEvent.setup()
      renderWithI18n(
        <DskWorkspaceView {...defaultProps} canAddCurrentImage={true} />
      )
      const addButton = screen.getByTitle('Add image')
      await user.click(addButton)
      expect(mockOnAddCurrentImage).toHaveBeenCalledTimes(1)
    })
  })

  describe('Image List', () => {
    const mockImage: DskImage = {
      id: 'test-1',
      name: 'TEST.SCR',
      scrData: [1, 2, 3],
      mode: 0,
      width: 160,
      height: 200,
      overscan: false,
      nColors: 16,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2],
      thumbnailDataUrl: 'data:image/png;base64,test',
      paletteColors: ['#000000', '#ff0000', '#00ff00']
    }

    it('should render image list when hasImages is true', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('should render image thumbnail with correct src', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'data:image/png;base64,test')
    })

    it('should render Classic hardware badge', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const badge = screen.getByTitle('CPC Classic (27 colors)')
      expect(badge).toHaveTextContent('Classic')
    })

    it('should render Plus hardware badge', () => {
      const plusImage = { ...mockImage, cpcHardware: 'plus' as const }
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[plusImage]}
          hasImages={true}
        />
      )
      const badge = screen.getByTitle('CPC Plus (4096 colors)')
      expect(badge).toHaveTextContent('Plus')
    })

    it('should render palette colors', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      mockImage.paletteColors?.forEach((color) => {
        const colorDiv = screen.getByTitle(new RegExp(color))
        expect(colorDiv).toHaveStyle({ backgroundColor: color })
      })
    })

    it('should call getColorTitle for each palette color', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      expect(mockGetColorTitle).toHaveBeenCalledTimes(3)
      expect(mockGetColorTitle).toHaveBeenCalledWith(0, '#000000')
      expect(mockGetColorTitle).toHaveBeenCalledWith(1, '#ff0000')
      expect(mockGetColorTitle).toHaveBeenCalledWith(2, '#00ff00')
    })

    it('should not render palette if paletteColors is undefined', () => {
      const imageWithoutPalette = { ...mockImage, paletteColors: undefined }
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[imageWithoutPalette]}
          hasImages={true}
        />
      )
      expect(screen.queryByTitle(/Color/)).not.toBeInTheDocument()
    })

    it('should render remove button for each image', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const removeButton = screen.getByTitle('Remove image')
      expect(removeButton).toBeInTheDocument()
    })

    it('should call onRemoveImage when remove button clicked', async () => {
      const user = userEvent.setup()
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const removeButton = screen.getByTitle('Remove image')
      await user.click(removeButton)
      expect(mockOnRemoveImage).toHaveBeenCalledTimes(1)
      expect(mockOnRemoveImage).toHaveBeenCalledWith('test-1')
    })

    it('should render multiple images', () => {
      const images = [
        mockImage,
        { ...mockImage, id: 'test-2', name: 'TEST2.SCR' },
        { ...mockImage, id: 'test-3', name: 'TEST3.SCR' }
      ]
      renderWithI18n(
        <DskWorkspaceView {...defaultProps} images={images} hasImages={true} />
      )
      expect(screen.getAllByRole('img')).toHaveLength(3)
    })

    it('should display image dimensions', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      expect(screen.getByText(/160×200/)).toBeInTheDocument()
    })

    it('should display mode label', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      expect(screen.getByText(/Mode 0/)).toBeInTheDocument()
    })
  })

  describe('Export Section', () => {
    const mockImage: DskImage = {
      id: 'test-1',
      name: 'TEST.SCR',
      scrData: [1, 2, 3],
      mode: 0,
      width: 160,
      height: 200,
      overscan: false,
      nColors: 16,
      scaleX: 1,
      scaleY: 1,
      cpcHardware: 'classic',
      paletteFirmware: [0, 1, 2],
      thumbnailDataUrl: 'data:image/png;base64,test'
    }

    it('should render export section when has images', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const exportButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('data-variant') === 'primary')
      expect(exportButton).toBeInTheDocument()
    })

    it('should call onExport when export button clicked', async () => {
      const user = userEvent.setup()
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const exportButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('data-variant') === 'primary')!
      await user.click(exportButton)
      expect(mockOnExport).toHaveBeenCalledTimes(1)
    })

    it('should render export button as primary variant', () => {
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[mockImage]}
          hasImages={true}
        />
      )
      const exportButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('data-variant') === 'primary')!
      expect(exportButton).toHaveAttribute('data-variant', 'primary')
    })
  })

  describe('Custom Badge', () => {
    it('should show custom badge for non-standard dimensions', () => {
      const customImage: DskImage = {
        id: 'test-1',
        name: 'CUSTOM.BIN',
        scrData: [1, 2, 3],
        mode: 0,
        width: 100,
        height: 100,
        overscan: false,
        nColors: 16,
        scaleX: 1,
        scaleY: 1,
        cpcHardware: 'classic',
        paletteFirmware: [0, 1, 2],
        thumbnailDataUrl: 'data:image/png;base64,test'
      }
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[customImage]}
          hasImages={true}
        />
      )
      expect(screen.getByText(/Custom/i)).toBeInTheDocument()
    })

    it('should not show custom badge for standard dimensions', () => {
      const standardImage: DskImage = {
        id: 'test-1',
        name: 'STANDARD.SCR',
        scrData: [1, 2, 3],
        mode: 0,
        width: 160,
        height: 200,
        overscan: false,
        nColors: 16,
        scaleX: 1,
        scaleY: 1,
        cpcHardware: 'classic',
        paletteFirmware: [0, 1, 2],
        thumbnailDataUrl: 'data:image/png;base64,test'
      }
      renderWithI18n(
        <DskWorkspaceView
          {...defaultProps}
          images={[standardImage]}
          hasImages={true}
        />
      )
      expect(screen.queryByText(/Custom/i)).not.toBeInTheDocument()
    })
  })
})
