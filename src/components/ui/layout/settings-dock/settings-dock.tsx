/**
 * The docked settings panel, as a shell both workshops fill.
 *
 * It sits in the layout flow next to the workspace so the live result stays
 * visible while settings are open, and becomes a full-height overlay below the
 * lg breakpoint (see `settings-dock.module.css`). What differs between the
 * image workshop and the tileset one is the tab list and the atom that opens
 * it — everything else, size and behaviour, is defined once here.
 */

import type { ComponentType, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import Icon, { type IconName } from '@/components/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import styles from './settings-dock.module.css'

export interface DockTab {
  readonly id: string
  readonly label: ReactNode
  readonly icon: IconName
  readonly component: ComponentType
}

export interface SettingsDockProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: ReactNode
  readonly icon?: IconName
  /** Accessible name of the panel itself. */
  readonly label: string
  /** Accessible name of the tab list. */
  readonly tabsLabel: string
  readonly closeLabel: string
  readonly tabs: readonly DockTab[]
}

export function SettingsDock({
  open,
  onClose,
  title,
  icon = 'GearIcon',
  label,
  tabsLabel,
  closeLabel,
  tabs
}: SettingsDockProps) {
  const firstTabRef = useRef<HTMLButtonElement>(null)

  // Focus the first tab when the panel opens, for immediate keyboard nav.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => firstTabRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [open])

  // Close on Escape, mirroring the previous modal behavior.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    globalThis.addEventListener('keydown', onKeyDown)
    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || tabs.length === 0) return null

  return (
    <aside className={styles.panel} aria-label={label}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <Icon name={icon} /> {title}
        </span>
        <button
          type='button'
          className={styles.closeButton}
          onClick={onClose}
          aria-label={closeLabel}
        >
          <Icon name='Cross2Icon' />
        </button>
      </div>

      <Tabs defaultValue={tabs[0].id} className={styles.container}>
        <TabsList className={styles.tabs} aria-label={tabsLabel}>
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
