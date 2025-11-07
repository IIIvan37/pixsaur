import * as SwitchPrimitive from '@radix-ui/react-switch'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import styles from './switch.module.css'

type SwitchProps = {
  readonly checked: boolean
  readonly onCheckedChange: (value: boolean) => void
  readonly label?: ReactNode
  readonly id: string
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  id
}: Readonly<SwitchProps>) {
  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <SwitchPrimitive.Root
        className={clsx(styles.root, checked && styles.rootChecked)}
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className={styles.thumb} />
      </SwitchPrimitive.Root>
    </div>
  )
}
