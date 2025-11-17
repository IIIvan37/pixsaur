/**
 * Tauri-specific export utilities using native file system APIs
 */

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { logger } from '@/utils/core'

/**
 * Save a file using Tauri's native file dialog and file system
 * @param data - File data as Blob or Uint8Array
 * @param defaultFilename - Default filename to suggest
 * @param filters - File type filters for the save dialog
 * @returns true if file was saved successfully, false if user cancelled
 */
export async function saveTauriFile(
  data: Blob | Uint8Array,
  defaultFilename: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<boolean> {
  // Open native save dialog
  const filePath = await save({
    defaultPath: defaultFilename,
    filters: filters || [
      {
        name: 'All Files',
        extensions: ['*']
      }
    ]
  })

  // User cancelled the dialog
  if (!filePath) {
    return false
  }

  // Convert Blob to Uint8Array if needed
  let uint8Data: Uint8Array
  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer()
    uint8Data = new Uint8Array(arrayBuffer)
  } else {
    uint8Data = data
  }

  try {
    // Write file using Tauri's fs API
    await writeFile(filePath, uint8Data)
    return true
  } catch (error) {
    logger.error('[Tauri Export] Failed to write file:', error)
    throw error
  }
}

/**
 * Save a ZIP file using Tauri's native APIs
 * @returns true if file was saved successfully, false if user cancelled
 */
export async function saveZipFileTauri(
  zipBlob: Blob,
  filename: string
): Promise<boolean> {
  return await saveTauriFile(zipBlob, filename, [
    {
      name: 'ZIP Archive',
      extensions: ['zip']
    },
    {
      name: 'All Files',
      extensions: ['*']
    }
  ])
}
