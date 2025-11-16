import type { CSSProperties, ReactNode } from 'react'
import { memo } from 'react'

/**
 * A flexible container component that applies flexbox layout properties.
 * Provides a convenient way to create flex layouts with consistent spacing and alignment.
 */
const Flex = ({
  children,
  direction = 'row',
  gap = 'var(--spacing-sm)',
  align = 'center',
  justify = 'flex-start',
  wrap = 'nowrap',
  style
}: {
  /** The content to be rendered inside the flex container */
  readonly children: ReactNode
  /** The flex direction */
  readonly direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  /** The gap between flex items */
  readonly gap?: CSSProperties['gap']
  /** How items are aligned along the cross axis */
  readonly align?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline'
  /** How items are distributed along the main axis */
  readonly justify?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
  /** Whether items should wrap to new lines */
  readonly wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'
  /** Additional inline styles to apply */
  readonly style?: CSSProperties
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap,
        ...style
      }}
    >
      {children}
    </div>
  )
}

Flex.displayName = 'Flex'

export default memo(Flex)
