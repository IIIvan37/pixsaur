import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri module
vi.mock('@/tauri', () => ({
  isTauri: vi.fn(() => false),
  getAppVersion: vi.fn()
}))

// Mock core module
vi.mock('@/core', () => ({
  isDevelopment: vi.fn(() => false)
}))

describe('VersionDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Reset VITE env
    vi.stubEnv('VITE_APP_VERSION', '1.0.0')
  })

  it('renders version from VITE_APP_VERSION in web mode', async () => {
    const { isTauri } = await import('@/tauri')
    vi.mocked(isTauri).mockReturnValue(false)

    const { VersionDisplay } = await import('./version-display')
    render(<VersionDisplay />)

    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    })
  })

  it('renders version from Tauri in Tauri mode', async () => {
    const { isTauri, getAppVersion } = await import('@/tauri')
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(getAppVersion).mockResolvedValue('2.0.0')

    const { VersionDisplay } = await import('./version-display')
    render(<VersionDisplay />)

    await waitFor(() => {
      expect(screen.getByText('v2.0.0')).toBeInTheDocument()
    })
  })

  it('shows DEV badge in development mode', async () => {
    const { isTauri } = await import('@/tauri')
    vi.mocked(isTauri).mockReturnValue(false)

    const { isDevelopment } = await import('@/core')
    vi.mocked(isDevelopment).mockReturnValue(true)

    const { VersionDisplay } = await import('./version-display')
    render(<VersionDisplay />)

    await waitFor(() => {
      expect(screen.getByText('DEV')).toBeInTheDocument()
    })
  })

  it('does not show DEV badge in production mode', async () => {
    const { isTauri } = await import('@/tauri')
    vi.mocked(isTauri).mockReturnValue(false)

    const { isDevelopment } = await import('@/core')
    vi.mocked(isDevelopment).mockReturnValue(false)

    const { VersionDisplay } = await import('./version-display')
    render(<VersionDisplay />)

    await waitFor(() => {
      expect(screen.queryByText('DEV')).not.toBeInTheDocument()
    })
  })

  it('falls back to VITE_APP_VERSION on Tauri error', async () => {
    const { isTauri, getAppVersion } = await import('@/tauri')
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(getAppVersion).mockRejectedValue(new Error('Tauri error'))

    const { VersionDisplay } = await import('./version-display')
    render(<VersionDisplay />)

    // Should fallback to VITE_APP_VERSION
    await waitFor(() => {
      expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    })
  })
})
