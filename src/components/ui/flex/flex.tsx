import { ReactNode, CSSProperties } from 'react'

export default function Flex({
  children,
  direction = 'row',
  gap = 'var(--grid-gap)',
  align = 'center',
  justify = 'flex-start',
  wrap = 'nowrap',
  style
}: {
  children: ReactNode
  direction?: CSSProperties['flexDirection']
  gap?: CSSProperties['gap']
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  wrap?: CSSProperties['flexWrap']
  style?: CSSProperties
}) {
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
