import { check } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '@/utils/is-tauri'
import { updaterLogger } from '@/utils/logger'
import { UpdaterView } from './updater-view'

/**
 * Check if running in Tauri environment
 */
// use shared util
/**
 * Auto-updater component for Tauri desktop app (Container/Smart Component)
 * Handles update checking, downloading, and installation logic
 */
export const Updater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkForUpdates = useCallback(async () => {
    try {
      updaterLogger.info('Checking for updates...')

      if (isTauri()) {
        updaterLogger.info('Running in Tauri environment, calling updater API')
        const update = await check()

        if (update) {
          updaterLogger.info(`Update available: ${update.version}`)
          updaterLogger.info(`Current version: ${update.currentVersion}`)
          updaterLogger.info(`Update date: ${update.date}`)
          updaterLogger.info(`Update body: ${update.body}`)
          setUpdateAvailable(true)
          setUpdateVersion(update.version)
          setPopoverOpen(true)
        } else {
          updaterLogger.info('No updates available')
        }
      } else {
        updaterLogger.info('Running in web environment (development mode)')
        // Updates not available in web mode
      }
    } catch (error) {
      updaterLogger.error('Failed to check for updates:', error)
      setError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }, [])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  const installUpdate = async () => {
    try {
      updaterLogger.info('Starting update download and installation...')
      updaterLogger.info(`User Agent: ${navigator.userAgent}`)
      setDownloading(true)
      setError(null)

      if (isTauri()) {
        const update = await check()

        if (!update) {
          updaterLogger.warn('No update found during installation attempt')
          setDownloading(false)
          setError('No update available')
          return
        }

        updaterLogger.info(`Downloading update ${update.version}...`)
        updaterLogger.info(`Download URL: ${JSON.stringify(update)}`)

        let downloadComplete = false
        let totalSize = 0
        let downloadedSize = 0

        // Download and install with progress tracking
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              totalSize = event.data.contentLength || 0
              updaterLogger.info(`Started downloading ${totalSize} bytes`)
              setDownloadProgress(0)
              break
            case 'Progress': {
              downloadedSize += event.data.chunkLength
              const progress =
                totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0
              setDownloadProgress(Math.round(progress))

              // Log progress every 10% to avoid spam
              if (downloadedSize % 1000000 < 100000) {
                // Log roughly every MB
                updaterLogger.info(
                  `Download progress: ${downloadedSize} / ${totalSize} bytes (${Math.round(
                    progress
                  )}%)`
                )
              }
              break
            }
            case 'Finished':
              updaterLogger.info('Download finished, installing...')
              setDownloadProgress(100)
              downloadComplete = true
              break
          }
        })

        if (!downloadComplete) {
          throw new Error('Download did not complete successfully')
        }

        updaterLogger.info(
          'Update installed successfully, preparing to relaunch...'
        )

        // Relaunch the app to apply the update
        const { relaunch } = await import('@tauri-apps/plugin-process')
        updaterLogger.info('Relaunching application...')
        await relaunch()
      } else {
        // In web mode, just log
        updaterLogger.info('Would download and install update in production')
        setDownloading(false)
        setUpdateAvailable(false)
        setPopoverOpen(false)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      updaterLogger.error('Failed to download and install update:', error)
      updaterLogger.error('Error details:', errorMessage)
      setDownloading(false)
      setError(errorMessage)
      // Keep notification visible so user can try again
    }
  }

  if (!updateAvailable) {
    return null
  }

  return (
    <UpdaterView
      updateVersion={updateVersion}
      downloading={downloading}
      downloadProgress={downloadProgress}
      popoverOpen={popoverOpen}
      error={error}
      onPopoverOpenChange={setPopoverOpen}
      onInstallUpdate={installUpdate}
    />
  )
}
