import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import type { ReactNode } from 'react'
import '@/styles/font-override.css'

interface ThemeProviderProps {
  children: ReactNode
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <Theme
      appearance='dark'
      accentColor='green'
      grayColor='slate'
      panelBackground='solid'
      scaling='100%'
      radius='medium'
    >
      {children}
    </Theme>
  )
}
