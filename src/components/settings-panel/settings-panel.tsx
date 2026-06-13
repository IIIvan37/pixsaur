/**
 * Centralized settings panel with tabs for all configuration options.
 *
 * Rendered as a docked side panel (not a floating modal) so the live preview
 * stays visible while the user tweaks settings. On narrow viewports it becomes
 * a full-width overlay (see settings-panel.module.css).
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { settingsPanelEnabledAtom } from '@/app/store/settings/settings-panel'
import Icon, { type IconName } from '@/components/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import styles from './settings-panel.module.css'
import { DitheringTab } from './tabs/dithering-tab.tsx'
import { DskTab } from './tabs/dsk-tab.tsx'
import { HardwareTab } from './tabs/hardware-tab.tsx'
import { RasterTab } from './tabs/raster-tab'
import { ResizeTab } from './tabs/resize-tab.tsx'
import { SourceTab } from './tabs/source-tab.tsx'

type TabId = 'source' | 'resize' | 'hardware' | 'dithering' | 'raster' | 'dsk'

interface TabDefinition {
  id: TabId
  label: React.ReactNode
  icon: IconName
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
    id: 'dsk',
    label: <Trans>Disque</Trans>,
    icon: 'FileIcon',
    component: DskTab
  }
]

export function SettingsPanel() {
  const { _ } = useLingui()
  const [enabled, setEnabled] = useAtom(settingsPanelEnabledAtom)
  const firstTabRef = useRef<HTMLButtonElement>(null)

  // Focus the first tab when the panel opens, for immediate keyboard nav.
  useEffect(() => {
    if (!enabled) return
    const id = setTimeout(() => firstTabRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [enabled])

  // Close on Escape, mirroring the previous modal behavior.
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnabled(false)
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [enabled, setEnabled])

  if (!enabled) return null

  return (
    <aside className={styles.panel} aria-label={_(msg`Panneau des paramètres`)}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <Icon name='GearIcon' /> <Trans>Settings</Trans>
        </span>
        <button
          type='button'
          className={styles.closeButton}
          onClick={() => setEnabled(false)}
          aria-label={_(msg`Fermer les paramètres`)}
        >
          <Icon name='Cross2Icon' />
        </button>
      </div>

      <Tabs defaultValue='source' className={styles.container}>
        <TabsList className={styles.tabs} aria-label='Settings tabs'>
          {tabs.map((tab, index) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={styles.tab}
              ref={index === 0 ? firstTabRef : undefined}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className={styles.content}
            tabIndex={-1}
          >
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  )
}
