import { useEffect, useState } from 'react'
import { getAppVersion, isTauri } from '@/tauri'
import { isDevelopment } from '@/utils/is-development'
import styles from './version-display.module.css'

export function VersionDisplay() {
  const [version, setVersion] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        // Ne charger Tauri que si on est dans un environnement Tauri
        if (isTauri()) {
          const appVersion = await getAppVersion()
          setVersion(appVersion)
        } else {
          // Fallback to package.json version for web
          setVersion(import.meta.env.VITE_APP_VERSION || '')
        }
      } catch {
        // En cas d'erreur, utiliser la version du package.json
        setVersion(import.meta.env.VITE_APP_VERSION || '')
      } finally {
        setIsLoading(false)
      }
    }

    fetchVersion()
  }, [])

  if (isLoading) {
    return null
  }

  return (
    <div className={styles.version}>
      {version ? `v${version}` : ''}
      {isDevelopment() && <span className={styles.devBadge}>DEV</span>}
    </div>
  )
}
