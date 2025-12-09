/**
 * Floating button to open the settings panel
 */

import { msg, Trans } from '@lingui/macro'
import { useLingui } from '@lingui/react'
import { useAtom } from 'jotai'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import Button from '@/components/ui/button/button'
import Icon from '@/components/ui/icon'

export function SettingsButton() {
  const { _ } = useLingui()
  const [_enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)

  return (
    <Button
      variant='secondary'
      onClick={() => setEnabled(true)}
      title={_(msg`Ouvrir les paramètres`)}
      aria-label={_(msg`Ouvrir le panneau des paramètres`)}
    >
      <Icon name='GearIcon' />
      <span style={{ marginLeft: '0.5rem' }}>
        <Trans>Paramètres</Trans>
      </span>
    </Button>
  )
}
