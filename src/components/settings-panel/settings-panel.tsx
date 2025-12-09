/**
 * Centralized settings panel with tabs for all configuration options
 */

import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import DraggableDialog from '@/components/ui/draggable-dialog'
import Icon from '@/components/ui/icon'
import styles from './settings-panel.module.css'
import { DitheringTab } from './tabs/dithering-tab.tsx'
import { ExportTab } from './tabs/export-tab.tsx'
import { HardwareTab } from './tabs/hardware-tab.tsx'
import { RasterTab } from './tabs/raster-tab'
import { ResizeTab } from './tabs/resize-tab.tsx'
import { SourceTab } from './tabs/source-tab.tsx'

type TabId =
  | 'source'
  | 'resize'
  | 'hardware'
  | 'dithering'
  | 'raster'
  | 'export'

interface TabDefinition {
  id: TabId
  label: React.ReactNode
  icon: string
  component: React.ComponentType
}

const tabs: TabDefinition[] = [
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
    id: 'export',
    label: <Trans>Export</Trans>,
    icon: 'DownloadIcon',
    component: ExportTab
  }
]

export function SettingsPanel() {
  const [enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)
  const [activeTab, setActiveTab] = useState<TabId>('source')

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component

  return (
    <DraggableDialog
      open={enabled}
      onOpenChange={setEnabled}
      title={
        <>
          <Icon name='GearIcon' /> <Trans>Settings</Trans>
        </>
      }
      defaultPosition={{ x: 100, y: 60 }}
    >
      <div className={styles.container}>
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon as any} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.content}>
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </DraggableDialog>
  )
}
