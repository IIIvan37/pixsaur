import type { PropsWithChildren } from 'react'
import Flex from '../../flex'
import styles from './panel.module.css'

interface PanelProps extends PropsWithChildren {
  compact?: boolean
}

export function Panel({ children, compact = false }: Readonly<PanelProps>) {
  return (
    <div className={`${styles.panel} ${compact ? styles.compact : ''}`}>
      <Flex
        direction='column'
        justify='flex-start'
        gap='1rem'
        align='flex-start'
      >
        {children}
      </Flex>
    </div>
  )
}
