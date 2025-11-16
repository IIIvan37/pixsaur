import type { ElementType, ReactNode } from 'react'
import styles from './section-title.module.css'

export type SectionTitleProps = {
  /** The title content */
  readonly children: ReactNode
  /** Semantic title level (h2 by default) */
  readonly level?: 2 | 3 | 4
  /** Additional CSS classes */
  readonly className?: string
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
  // We intentionally create the tag name dynamically (h2/h3/h4) to keep the
  // component compact while preserving semantic headings. Sonar's a11y rule
  // 'useSemanticElements' flags dynamic element usage, but here we use only
  // valid heading tags. Suppress that specific Sonar warning for this line.
  // @sonar-ignore-next-line a11y/useSemanticElements: Dynamic heading used by design
  const Tag = `h${level}` as ElementType

  return (
    <Tag className={`${styles.sectionTitle} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
