import type { InputHTMLAttributes } from 'react'
import styles from './checkbox.module.css'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
}

export default function Checkbox({
  label,
  className,
  ...props
}: CheckboxProps) {
  if (label) {
    return (
      <label className={`${styles.checkboxLabel} ${className || ''}`}>
        <input type='checkbox' className={styles.checkbox} {...props} />
        {label}
      </label>
    )
  }

  return <input type='checkbox' className={styles.checkbox} {...props} />
}
