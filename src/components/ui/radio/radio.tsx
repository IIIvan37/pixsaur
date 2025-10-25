import type { InputHTMLAttributes } from 'react'
import styles from './radio.module.css'

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
}

export default function Radio({ label, className, ...props }: RadioProps) {
  if (label) {
    return (
      <label className={`${styles.radioLabel} ${className || ''}`}>
        <input type='radio' className={styles.radio} {...props} />
        {label}
      </label>
    )
  }

  return <input type='radio' className={styles.radio} {...props} />
}
