import { ReactNode, CSSProperties } from 'react'

export function Grid({
  children,
  columns = 2,
  gap = 'var(--grid-gap)',
  style
}: {
  children: ReactNode
  columns?: number | string
  gap?: CSSProperties['gap']
  style?: CSSProperties
}) {
  const template =
    typeof columns === 'number'
      ? `repeat(${columns}, var(--grid-col))`
      : columns

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: template,
        gap,
        ...style
      }}
    >
      {children}
    </div>
  )
}
