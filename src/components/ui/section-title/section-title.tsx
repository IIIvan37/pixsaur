import type { ElementType, ReactNode } from 'react'
import styles from './section-title.module.css'

export type SectionTitleProps = {
  /** The title content */
  children: ReactNode
  /** Semantic title level (h2 by default) */
  level?: 2 | 3 | 4
  /** Additional CSS classes */
  className?: string
}

/**
 * Composant SectionTitle unifié - DRY principle implementation
 *
 * Remplace les titres dupliqués dans :
 * - image-controls-view.tsx (Mode, Espace de couleur)
 * - contrast-strategy-selector.tsx (Contraste)
 *
 * @example
 * ```tsx
 * <SectionTitle>Mode</SectionTitle>
 * <SectionTitle level={3}>Sous-section</SectionTitle>
 * ```
 */
export function SectionTitle({
  children,
  level = 2,
  className = ''
}: SectionTitleProps) {
  const Tag = `h${level}` as ElementType

  return (
    <Tag className={`${styles.sectionTitle} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
