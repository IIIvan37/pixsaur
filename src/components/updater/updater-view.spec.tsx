import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdaterView } from './updater-view'

describe('UpdaterView', () => {
  const defaultProps = {
    updateVersion: '0.1.22',
    downloading: false,
    downloadProgress: 0,
    popoverOpen: true,
    error: null,
    onPopoverOpenChange: vi.fn(),
    onInstallUpdate: vi.fn()
  }

  it('renders update notification with version', () => {
    render(<UpdaterView {...defaultProps} />)

    expect(screen.getByText(/Mise à jour disponible/i)).toBeInTheDocument()
    // Version number is displayed - multiple elements may contain it, verify at least one exists
    const elementsWithVersion = screen.queryAllByText((_content, element) => {
      return element?.textContent?.includes('0.1.22') ?? false
    })
    expect(elementsWithVersion.length).toBeGreaterThan(0)
  })

  it('shows update description', () => {
    render(<UpdaterView {...defaultProps} />)

    expect(
      screen.getByText(/Une nouvelle version de Pixsaur est disponible/i)
    ).toBeInTheDocument()
  })

  it('renders Later and Install Update buttons', () => {
    render(<UpdaterView {...defaultProps} />)

    expect(
      screen.getByRole('button', { name: /Plus tard/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Installer la mise à jour/i })
    ).toBeInTheDocument()
  })

  it('calls onInstallUpdate when Install Update button is clicked', async () => {
    const user = userEvent.setup()
    const onInstallUpdate = vi.fn()

    render(<UpdaterView {...defaultProps} onInstallUpdate={onInstallUpdate} />)

    const installButton = screen.getByRole('button', {
      name: /Installer la mise à jour/i
    })
    await user.click(installButton)

    expect(onInstallUpdate).toHaveBeenCalledTimes(1)
  })

  it('calls onPopoverOpenChange when Later button is clicked', async () => {
    const user = userEvent.setup()
    const onPopoverOpenChange = vi.fn()

    render(
      <UpdaterView
        {...defaultProps}
        onPopoverOpenChange={onPopoverOpenChange}
      />
    )

    const laterButton = screen.getByRole('button', { name: /Plus tard/i })
    await user.click(laterButton)

    expect(onPopoverOpenChange).toHaveBeenCalledWith(false)
  })

  describe('downloading state', () => {
    it('shows downloading text when downloading', () => {
      render(<UpdaterView {...defaultProps} downloading={true} />)

      expect(
        screen.getByRole('button', { name: /Téléchargement/i })
      ).toBeInTheDocument()
    })

    it('disables both buttons when downloading', () => {
      render(<UpdaterView {...defaultProps} downloading={true} />)

      expect(screen.getByRole('button', { name: /Plus tard/i })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: /Téléchargement/i })
      ).toBeDisabled()
    })

    it('shows progress bar with correct percentage', () => {
      render(
        <UpdaterView
          {...defaultProps}
          downloading={true}
          downloadProgress={45}
        />
      )

      expect(screen.getByText('45%')).toBeInTheDocument()
      const progressFill = document.querySelector(
        "[class*='progressFill']"
      ) as HTMLElement
      expect(progressFill).toHaveStyle({ width: '45%' })
    })

    it('does not show progress bar when not downloading', () => {
      render(<UpdaterView {...defaultProps} downloading={false} />)

      expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
    })

    it('does not show progress bar when progress is 0', () => {
      render(
        <UpdaterView
          {...defaultProps}
          downloading={true}
          downloadProgress={0}
        />
      )

      expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when error is present', () => {
      const errorMessage = 'Network error occurred'
      render(<UpdaterView {...defaultProps} error={errorMessage} />)

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('does not show error message when error is null', () => {
      render(<UpdaterView {...defaultProps} error={null} />)

      const errorContainer = document.querySelector('.errorMessage')
      expect(errorContainer).not.toBeInTheDocument()
    })
  })

  describe('popover state', () => {
    it('respects popoverOpen prop', () => {
      const { rerender } = render(
        <UpdaterView {...defaultProps} popoverOpen={false} />
      )

      // Popover should be closed
      expect(
        screen.queryByText(/Mise à jour disponible/i)
      ).not.toBeInTheDocument()

      // Open popover
      rerender(<UpdaterView {...defaultProps} popoverOpen={true} />)

      expect(screen.getByText(/Mise à jour disponible/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible trigger button with aria-label', () => {
      render(<UpdaterView {...defaultProps} />)

      // Lingui interpolates version separately, aria-label shows "Mise à jour disponible : version "
      const trigger = screen.getByLabelText(/Mise à jour disponible : version/i)
      expect(trigger).toBeInTheDocument()
    })

    it('buttons have correct roles', () => {
      render(<UpdaterView {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
