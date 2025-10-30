import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'

/**
 * Auto-updater component for Tauri desktop app
 * Checks for updates on mount and allows user to install them
 */
export const Updater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)

  const checkForUpdates = useCallback(async () => {
    try {
      const update = await check()

      if (update) {
        setUpdateAvailable(true)
        setUpdateVersion(update.version)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  }, [])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  const installUpdate = async () => {
    try {
      setDownloading(true)
      const update = await check()

      if (update) {
        await update.downloadAndInstall()

        // Relaunch the app to apply the update
        await relaunch()
      }
    } catch (error) {
      console.error('Failed to install update:', error)
      setDownloading(false)
    }
  }

  if (!updateAvailable) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        padding: '16px 24px',
        background: '#4CAF50',
        color: 'white',
        borderRadius: 8,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: 9999
      }}
    >
      <p style={{ margin: 0, marginBottom: 8, fontWeight: 'bold' }}>
        Update available: v{updateVersion}
      </p>
      <button
        type='button'
        onClick={installUpdate}
        disabled={downloading}
        style={{
          background: 'white',
          color: '#4CAF50',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 4,
          cursor: downloading ? 'wait' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {downloading ? 'Installing...' : 'Update Now'}
      </button>
    </div>
  )
}
