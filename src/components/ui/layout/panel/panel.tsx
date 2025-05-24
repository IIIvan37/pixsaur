import { PropsWithChildren } from 'react'
import Flex from '../../flex'
import styles from './panel.module.css'
export function Panel({ children }: PropsWithChildren) {
  return (
    <div className={styles.panel}>
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
