import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type DockTab, SettingsDock } from './settings-dock'

const tabs: DockTab[] = [
  {
    id: 'first',
    label: 'Premier',
    icon: 'GearIcon',
    component: () => <p>contenu du premier</p>
  },
  {
    id: 'second',
    label: 'Second',
    icon: 'ImageIcon',
    component: () => <p>contenu du second</p>
  }
]

function renderDock(
  overrides: Partial<React.ComponentProps<typeof SettingsDock>> = {}
) {
  const onClose = vi.fn()
  render(
    <SettingsDock
      open
      onClose={onClose}
      title='Réglages'
      label='Panneau des réglages'
      tabsLabel='Onglets'
      closeLabel='Fermer'
      tabs={tabs}
      {...overrides}
    />
  )
  return { onClose }
}

describe('SettingsDock', () => {
  it('shows nothing while closed', () => {
    renderDock({ open: false })

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows nothing when it has no tab to show', () => {
    renderDock({ tabs: [] })

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('opens on the first tab', () => {
    renderDock()

    expect(screen.getByText('contenu du premier')).toBeVisible()
  })

  it('shows the tab that is clicked', async () => {
    renderDock()

    await userEvent.click(screen.getByRole('tab', { name: 'Second' }))

    expect(screen.getByText('contenu du second')).toBeVisible()
  })

  it('closes on the close button', async () => {
    const { onClose } = renderDock()

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const { onClose } = renderDock()

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
