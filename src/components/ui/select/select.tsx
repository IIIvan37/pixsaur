import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import * as RadixSelect from '@radix-ui/react-select'
import type { ReactNode } from 'react'

import styles from './select.module.css'

type Props = {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly children: ReactNode
  readonly disabled?: boolean
  /** Accessible name of the trigger — a visible label cannot reach it. */
  readonly 'aria-label'?: string
}

export function Select({
  value,
  onValueChange,
  children,
  disabled = false,
  'aria-label': ariaLabel
}: Props) {
  return (
    <RadixSelect.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <RadixSelect.Trigger className={styles.trigger} aria-label={ariaLabel}>
        <RadixSelect.Value />
        <RadixSelect.Icon className={styles.icon}>
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content}>
          <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

type ItemProps = {
  readonly value: string
  readonly children: ReactNode
}

export function SelectItem({ value, children }: Readonly<ItemProps>) {
  return (
    <RadixSelect.Item className={styles.item} value={value}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className={styles.check}>
        <CheckIcon />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
