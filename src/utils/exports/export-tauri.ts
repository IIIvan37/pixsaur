/**
 * Tauri-specific export utilities using native file system APIs
 */

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

/**
 * Save a file using Tauri's native file dialog and file system
 * @param data - File data as Blob or Uint8Array
 * @param defaultFilename - Default filename to suggest
 * @param filters - File type filters for the save dialog
 */
export async function saveTauriFile(
  data: Blob | Uint8Array,
  defaultFilename: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<void> {
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
    return
  }

  // Convert Blob to Uint8Array if needed
  let uint8Data: Uint8Array
  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer()
    uint8Data = new Uint8Array(arrayBuffer)
  } else {
    uint8Data = data
  }

  // Write file using Tauri's fs API
  await writeFile(filePath, uint8Data)
}

/**
 * Save a ZIP file using Tauri's native APIs
 */
export async function saveZipFileTauri(
  zipBlob: Blob,
  filename: string
): Promise<void> {
  await saveTauriFile(zipBlob, filename, [
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
