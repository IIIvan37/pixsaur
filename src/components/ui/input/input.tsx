import type { InputHTMLAttributes } from 'react'
import styles from './input.module.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  /**
   * Half the height and a quieter label — for a field among many in a settings
   * panel, where the default size reads as a form of its own.
   */
  compact?: boolean
}

export default function Input({
  label,
  error,
  className,
  id,
  compact = false,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replaceAll(' ', '-')
  const inputClass = [
    styles.input,
    compact ? styles.compactInput : '',
    error ? styles.inputError : '',
    className || ''
  ]
    .filter(Boolean)
    .join(' ')

  if (label) {
    return (
      <div
        className={`${styles.inputGroup} ${compact ? styles.compactGroup : ''}`}
      >
        <label
          htmlFor={inputId}
          className={`${styles.label} ${compact ? styles.compactLabel : ''}`}
        >
          {label}
        </label>
        <input id={inputId} className={inputClass} {...props} />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    )
  }

  return <input id={inputId} className={inputClass} {...props} />
}
