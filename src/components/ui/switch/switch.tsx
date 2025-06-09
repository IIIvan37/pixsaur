import * as SwitchPrimitive from '@radix-ui/react-switch'
import styles from './switch.module.css'
import clsx from 'clsx'

type SwitchProps = {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label?: string
  id: string
}

export function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
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
