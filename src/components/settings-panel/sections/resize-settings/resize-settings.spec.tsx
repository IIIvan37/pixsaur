import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { selectionAtom } from '@/app/store/image/image'
import { renderWithProviders } from '@/test-utils'
import { ResizeSettings } from './resize-settings'

function WithSelection({ children }: { children: React.ReactNode }) {
  const setSelection = useSetAtom(selectionAtom)

  useEffect(() => {
    setSelection({ sx: 0, sy: 0, width: 320, height: 200 })
  }, [setSelection])

  return <>{children}</>
}

describe('ResizeSettings', () => {
  it('renders resize mode options', () => {
    renderWithProviders(<ResizeSettings />)

    expect(screen.getByText('Mode de redimensionnement')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Auto/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Origin/i })).toBeInTheDocument()
  })

  it('renders center image toggle', () => {
    renderWithProviders(<ResizeSettings />)

    expect(screen.getByText("Centrage de l'image")).toBeInTheDocument()
    expect(screen.getByLabelText(/Centrer l'image/i)).toBeInTheDocument()
  })

  it('shows selection info when selection exists', () => {
    renderWithProviders(
      <WithSelection>
        <ResizeSettings />
      </WithSelection>
    )

    expect(screen.getByText(/320 × 200 px/i)).toBeInTheDocument()
  })

  it('allows switching between resize modes', async () => {
    renderWithProviders(<ResizeSettings />)

    const autoRadio = screen.getByRole('radio', { name: /Auto/i })
    const originRadio = screen.getByRole('radio', { name: /Origin/i })

    // Auto should be selected by default
    expect(autoRadio).toBeChecked()

    // Switch to origin
    await userEvent.click(originRadio)
    expect(originRadio).toBeChecked()
    expect(autoRadio).not.toBeChecked()
  })

  it('allows toggling center image', async () => {
    renderWithProviders(<ResizeSettings />)

    const centerSwitch = screen.getByRole('switch', {
      name: /Centrer l'image/i
    })

    const initialState = centerSwitch.getAttribute('aria-checked') === 'true'

    await userEvent.click(centerSwitch)

    expect(centerSwitch.getAttribute('aria-checked')).toBe(
      String(!initialState)
    )
  })
})
