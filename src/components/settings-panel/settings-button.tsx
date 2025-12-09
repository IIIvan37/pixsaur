/**
 * Floating button to open the settings panel
 */

import { useAtom } from 'jotai'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import Button from '@/components/ui/button/button'
import Icon from '@/components/ui/icon'

export function SettingsButton() {
  const [_enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)

  return (
    <Button
      variant='secondary'
      onClick={() => setEnabled(true)}
      title='Open Settings'
      aria-label='Open settings panel'
    >
      <Icon name='GearIcon' />
      <span style={{ marginLeft: '0.5rem' }}>Settings</span>
    </Button>
  )
}
