import type { InputHTMLAttributes } from 'react'
import styles from './input.module.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export default function Input({
  label,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replaceAll(' ', '-')

  if (label) {
    return (
      <div className={styles.inputGroup}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <input
          id={inputId}
          className={`${styles.input} ${error ? styles.inputError : ''} ${
            className || ''
          }`}
          {...props}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    )
  }

  return (
    <input
      id={inputId}
      className={`${styles.input} ${error ? styles.inputError : ''} ${
        className || ''
      }`}
      {...props}
    />
  )
}
