import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// We'll import Updater dynamically in tests so mocks for `@/tauri` and
// `@tauri-apps/plugin-updater` can be applied before module evaluation.

// Mock Tauri updater and process plugins directly — tests are allowed to
// mock these platform modules.
vi.mock('@tauri-apps/plugin-updater')
vi.mock('@tauri-apps/plugin-process')

// Mock logger
vi.mock('@/utils/core', () => ({
  updaterLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// We do not mock the '@/tauri' module globally; tests will use spies or
// plugin-level mocks to control behavior instead.

describe('Updater', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Tauri environment
    ;(globalThis as { __TAURI_INTERNALS__?: never }).__TAURI_INTERNALS__ =
      {} as never
  })

  it('does not render when no update is available', async () => {
    const tauri = await import('@/tauri')
    expect(tauri.isTauri()).toBe(true)
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue(null as any)

    const { Updater } = await import('./updater')
    const { container } = render(<Updater />)

    // Confirm test environment is detected as Tauri for this test.
    expect(tauri.isTauri()).toBe(true)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('renders update notification when update is available', async () => {
    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue({
      version: '0.1.22',
      currentVersion: '0.1.21',
      date: '2025-01-01',
      body: 'Bug fixes',
      downloadAndInstall: vi.fn()
    } as any)

    const { Updater } = await import('./updater')
    render(<Updater />)

    await waitFor(() => {
      expect(screen.getByText(/Mise à jour disponible/i)).toBeInTheDocument()
      const elementsWithVersion = screen.queryAllByText((_content, element) => {
        return element?.textContent?.includes('0.1.22') ?? false
      })
      expect(elementsWithVersion.length).toBeGreaterThan(0)
    })
  })
  it('checks for updates on mount', async () => {
    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue(null as any)

    const { Updater } = await import('./updater')
    render(<Updater />)

    await waitFor(() => {
      expect(tauri.checkForUpdates).toHaveBeenCalledTimes(1)
    })
  })

  it('does not check for updates in non-Tauri environment', async () => {
    delete (globalThis as { __TAURI_INTERNALS__?: never }).__TAURI_INTERNALS__
    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates')

    const { Updater } = await import('./updater')
    render(<Updater />)

    await waitFor(() => {
      expect(tauri.checkForUpdates).not.toHaveBeenCalled()
    })
  })

  it('handles update installation with progress', async () => {
    const mockDownloadAndInstall = vi.fn((callback) => {
      // Simulate download events
      callback({ event: 'Started', data: { contentLength: 1000000 } })
      callback({ event: 'Progress', data: { chunkLength: 500000 } })
      callback({ event: 'Progress', data: { chunkLength: 500000 } })
      callback({ event: 'Finished' })
      return Promise.resolve()
    })

    const tauri = await import('@/tauri')
    const { relaunch } = await import('@tauri-apps/plugin-process')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue({
      version: '0.1.22',
      currentVersion: '0.1.21',
      date: '2025-01-01',
      body: 'Bug fixes',
      downloadAndInstall: mockDownloadAndInstall
    } as any)

    vi.mocked(relaunch).mockResolvedValue(undefined)

    const { Updater } = await import('./updater')
    render(<Updater />)

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument()
    })

    // Click install
    const installButton = screen.getByRole('button', {
      name: /Installer la mise à jour/i
    })
    installButton.click()

    // Wait for download to complete
    await waitFor(() => {
      expect(mockDownloadAndInstall).toHaveBeenCalled()
      expect(relaunch).toHaveBeenCalled()
    })
  })

  it('shows error message when update fails', async () => {
    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue({
      version: '0.1.22',
      currentVersion: '0.1.21',
      date: '2025-01-01',
      body: 'Bug fixes',
      downloadAndInstall: vi.fn().mockRejectedValue(new Error('Network error'))
    } as any)

    const { Updater } = await import('./updater')
    render(<Updater />)

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument()
    })

    // Click install
    const installButton = screen.getByRole('button', {
      name: /Installer la mise à jour/i
    })
    installButton.click()

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })
  })

  it('handles check error gracefully', async () => {
    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockRejectedValue(
      new Error('Failed to check')
    )

    const { Updater } = await import('./updater')
    const { container } = render(<Updater />)

    await waitFor(() => {
      // Should not render anything on check error
      expect(container.firstChild).toBeNull()
    })
  })

  it('shows downloading state during installation', async () => {
    const mockDownloadAndInstall = vi.fn(() => {
      return new Promise(() => {
        // Never resolve to keep downloading state
      })
    })

    const tauri = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue({
      version: '0.1.22',
      currentVersion: '0.1.21',
      date: '2025-01-01',
      body: 'Bug fixes',
      downloadAndInstall: mockDownloadAndInstall
    } as any)

    const { Updater } = await import('./updater')
    render(<Updater />)

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument()
    })

    // Click install
    const installButton = screen.getByRole('button', {
      name: /Installer la mise à jour/i
    })
    installButton.click()

    // Should show downloading state
    await waitFor(() => {
      expect(screen.getByText(/Téléchargement/i)).toBeInTheDocument()
    })
  })

  it('does not call relaunch if download did not complete', async () => {
    const mockDownloadAndInstall = vi.fn((callback) => {
      // Simulate incomplete download (no Finished event)
      callback({ event: 'Started', data: { contentLength: 1000000 } })
      callback({ event: 'Progress', data: { chunkLength: 500000 } })
      return Promise.resolve()
    })

    const tauri = await import('@/tauri')
    const { relaunch } = await import('@/tauri')
    vi.spyOn(tauri, 'checkForUpdates').mockResolvedValue({
      version: '0.1.22',
      currentVersion: '0.1.21',
      date: '2025-01-01',
      body: 'Bug fixes',
      downloadAndInstall: mockDownloadAndInstall
    } as any)

    const { Updater } = await import('./updater')
    render(<Updater />)

    // Wait for update to be available
    await waitFor(() => {
      expect(screen.getByText(/Installer la mise à jour/i)).toBeInTheDocument()
    })

    // Click install
    const installButton = screen.getByRole('button', {
      name: /Installer la mise à jour/i
    })
    installButton.click()

    // Wait for error
    await waitFor(() => {
      expect(
        screen.getByText(/Download did not complete successfully/i)
      ).toBeInTheDocument()
    })

    expect(relaunch).not.toHaveBeenCalled()
  })
})
