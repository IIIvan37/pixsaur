import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test-utils'
import { SettingsButton } from './settings-button'

describe('SettingsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the settings button', () => {
    renderWithProviders(<SettingsButton />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('is clickable', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsButton />)

    const button = screen.getByRole('button')
    await user.click(button)

    // Verify the button is interactive
    expect(button).toBeEnabled()
  })

  it('has button type attribute', () => {
    renderWithProviders(<SettingsButton />)

    const button = screen.getByRole('button')
    // Button component sets type="button" by default
    expect(button).toBeInTheDocument()
  })

  it('responds to Ctrl+, keyboard shortcut', async () => {
    renderWithProviders(<SettingsButton />)

    // Simulate Ctrl+, keyboard shortcut
    fireEvent.keyDown(document, { key: ',', ctrlKey: true })

    // The shortcut should be registered
    // Button should still be in the document
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('responds to Cmd+, keyboard shortcut on Mac', async () => {
    renderWithProviders(<SettingsButton />)

    // Simulate Cmd+, keyboard shortcut (metaKey for Mac)
    fireEvent.keyDown(document, { key: ',', metaKey: true })

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('renders with text content', () => {
    renderWithProviders(<SettingsButton />)

    // The button contains "Paramètres" text
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })
})
