import * as Collapsible from '@radix-ui/react-collapsible'
import type { ReactNode } from 'react'
import { useState } from 'react'
import styles from './collapsible-section.module.css'

interface CollapsibleSectionProps {
  readonly title: ReactNode
  readonly children: ReactNode
  readonly defaultOpen?: boolean
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly disabled?: boolean
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  disabled = false
}: Readonly<CollapsibleSectionProps>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const handleOpenChange = (open: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(open)
    }
    onOpenChange?.(open)
  }

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      className={styles.section}
    >
      <Collapsible.Trigger asChild>
        <button
          type='button'
          className={styles.sectionHeader}
          disabled={disabled}
        >
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionToggle}>{isOpen ? '▲' : '▼'}</span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className={styles.sectionContent}>
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
