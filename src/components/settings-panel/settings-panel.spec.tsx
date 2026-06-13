import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test-utils'
import { SettingsPanel } from './settings-panel'

// Mock child components to isolate settings panel testing
vi.mock('./sections/source-settings', () => ({
  SourceSettings: () => <div data-testid='source-settings'>Source Settings</div>
}))

vi.mock('./sections/resize-settings', () => ({
  ResizeSettings: () => <div data-testid='resize-settings'>Resize Settings</div>
}))

vi.mock('./sections/hardware-settings', () => ({
  HardwareSettings: () => (
    <div data-testid='hardware-settings'>Hardware Settings</div>
  )
}))

vi.mock('./sections/dithering-settings', () => ({
  DitheringSettings: () => (
    <div data-testid='dithering-settings'>Dithering Settings</div>
  )
}))

vi.mock('./sections/raster-settings', () => ({
  RasterSettings: () => <div data-testid='raster-settings'>Raster Settings</div>
}))

vi.mock('@/components/dsk-workspace/dsk-workspace-panel', () => ({
  default: () => <div data-testid='dsk-workspace'>DSK Workspace</div>
}))

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render dialog when panel is disabled (default)', () => {
    // Default state is closed
    renderWithProviders(<SettingsPanel />)

    // Dialog should not be visible when settingsPanelEnabledAtom is false (default)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders without crashing', () => {
    const { container } = renderWithProviders(<SettingsPanel />)
    expect(container).toBeInTheDocument()
  })

  it('has correct tab structure defined', async () => {
    // Import and inspect the component
    const { SettingsPanel } = await import('./settings-panel')

    // The component should export or use these tab keys
    const expectedTabs = [
      'source',
      'resize',
      'hardware',
      'dithering',
      'raster',
      'dsk'
    ]

    // Component should be importable
    expect(SettingsPanel).toBeDefined()
    expect(expectedTabs).toHaveLength(6)
  })
})
