/**
 * A label over its own control, the shape every setting of the workshop takes.
 *
 * The label is written once and serves both eyes and screen reader: a field
 * whose visible text and `aria-label` were kept in step by hand drifted apart
 * as soon as one of the two was reworded.
 */

import type { ReactNode } from 'react'
import { Select } from '@/components/ui/select'
import styles from './tileset-workshop.module.css'

export interface LabelledSelectProps {
  /** Already translated — it is both the visible text and the accessible name. */
  label: string
  value: string
  onValueChange: (value: string) => void
  /** A list of long options tips over half a width: it takes the whole row. */
  wide?: boolean
  disabled?: boolean
  children: ReactNode
}

export function LabelledSelect({
  label,
  value,
  onValueChange,
  wide,
  disabled,
  children
}: Readonly<LabelledSelectProps>) {
  return (
    <div
      className={wide ? `${styles.field} ${styles.fieldWide}` : styles.field}
    >
      <span className={styles.label}>{label}</span>
      <Select
        aria-label={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        {children}
      </Select>
    </div>
  )
}
