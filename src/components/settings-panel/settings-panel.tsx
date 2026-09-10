/**
 * The image workshop's settings: its six tabs, poured into the shared dock.
 *
 * The dock (size, sticky behaviour, overlay below the lg breakpoint) lives in
 * `components/ui/layout/settings-dock`; this file only says what goes in it.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import {
  type DockTab,
  SettingsDock
} from '@/components/ui/layout/settings-dock'
import { DitheringTab } from './tabs/dithering-tab.tsx'
import { DskTab } from './tabs/dsk-tab.tsx'
import { HardwareTab } from './tabs/hardware-tab.tsx'
import { RasterTab } from './tabs/raster-tab'
import { ResizeTab } from './tabs/resize-tab.tsx'
import { SourceTab } from './tabs/source-tab.tsx'

const tabs: DockTab[] = [
  {
    id: 'source',
    label: <Trans>Source</Trans>,
    icon: 'ImageIcon',
    component: SourceTab
  },
  {
    id: 'resize',
    label: <Trans>Resize</Trans>,
    icon: 'AspectRatioIcon',
    component: ResizeTab
  },
  {
    id: 'hardware',
    label: <Trans>Hardware</Trans>,
    icon: 'ComponentInstanceIcon',
    component: HardwareTab
  },
  {
    id: 'dithering',
    label: <Trans>Dithering</Trans>,
    icon: 'BlendingModeIcon',
    component: DitheringTab
  },
  {
    id: 'raster',
    label: <Trans>Raster</Trans>,
    icon: 'GearIcon',
    component: RasterTab
  },
  {
    id: 'dsk',
    label: <Trans>Disque</Trans>,
    icon: 'FileIcon',
    component: DskTab
  }
]

export function SettingsPanel() {
  const { _ } = useLingui()
  const [enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)

  return (
    <SettingsDock
      open={enabled}
      onClose={() => setEnabled(false)}
      title={<Trans>Settings</Trans>}
      label={_(msg`Panneau des paramètres`)}
      tabsLabel='Settings tabs'
      closeLabel={_(msg`Fermer les paramètres`)}
      tabs={tabs}
    />
  )
}
