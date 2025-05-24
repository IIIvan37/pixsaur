import { ReactNode, useEffect } from 'react'
import { theme } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    function injectVars(
      prefix: string,
      obj: Record<string, string | object>,
      set: (k: string, v: string) => void
    ) {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = `${prefix}-${key}`
        if (typeof value === 'string') {
          set(fullKey, value)
        } else {
          injectVars(fullKey, value as Record<string, string | object>, set)
        }
      })
    }
    const root = document.documentElement

    const setVar = (key: string, val: string) =>
      root.style.setProperty(key, val)

    injectVars('--color', theme.colors, setVar)
    injectVars('--font', theme.font, setVar)
    injectVars('--spacing', theme.spacing, setVar)
    injectVars('--radius', theme.radius, setVar)
    injectVars('--shadow', theme.shadow, setVar)
    injectVars('--spinner', theme.spinner, setVar)
  }, [])

  return <>{children}</>
}
