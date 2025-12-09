/**
 * Floating button to open the settings panel
 */

import { useAtom } from 'jotai'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import Icon from '@/components/ui/icon'
import styles from './settings-button.module.css'

export function SettingsButton() {
  const [_enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)

  return (
    <button
      type='button'
      className={styles.button}
      onClick={() => setEnabled(true)}
      title='Open Settings'
      aria-label='Open settings panel'
    >
      <Icon name='GearIcon' />
      <span className={styles.label}>Settings</span>
    </button>
  )
}
