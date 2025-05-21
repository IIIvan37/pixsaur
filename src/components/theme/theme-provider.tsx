import { ReactNode, useEffect } from 'react'
import { theme } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const setVar = (key: string, val: string) =>
      root.style.setProperty(key, val)

    Object.entries(theme.colors).forEach(([k, v]) => {
      if (typeof v === 'string') {
        root.style.setProperty(`--color-${k}`, v)
      }

      // Couleurs imbriquées (ex : disabled.thumb → --color-disabled-thumb)
      if (typeof v === 'object') {
        Object.entries(v).forEach(([subKey, subValue]) => {
          root.style.setProperty(`--color-${k}-${subKey}`, subValue)
        })
      }
    })
    Object.entries(theme.font.size).forEach(([k, v]) =>
      setVar(`--font-size-${k}`, v)
    )
    setVar('--font-family', theme.font.family)
    Object.entries(theme.spacing).forEach(([k, v]) => setVar(`--space-${k}`, v))
    Object.entries(theme.radius).forEach(([k, v]) => setVar(`--radius-${k}`, v))
    Object.entries(theme.shadow).forEach(([k, v]) => setVar(`--shadow-${k}`, v))
    Object.entries(theme.spinner).forEach(([k, v]) =>
      setVar(`--spinner-${k}`, v)
    )
    Object.entries(theme.grid).forEach(([k, v]) => setVar(`--grid-${k}`, v))
  }, [])

  return <>{children}</>
}
