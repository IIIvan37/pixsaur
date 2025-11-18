import { logger } from '@/core'
import { save, writeFile } from '@/tauri'

export async function saveTauriFile(
  data: Blob | Uint8Array,
  defaultFilename: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<boolean> {
  const filePath = await save({
    defaultPath: defaultFilename,
    filters: filters || [
      {
        name: 'All Files',
        extensions: ['*']
      }
    ]
  })

  if (!filePath) return false

  let uint8Data: Uint8Array
  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer()
    uint8Data = new Uint8Array(arrayBuffer)
  } else {
    uint8Data = data
  }

  try {
    await writeFile(filePath, uint8Data)
    return true
  } catch (error) {
    logger.error('[Tauri Export] Failed to write file:', error)
    throw error
  }
}

export async function saveZipFileTauri(zipBlob: Blob, filename: string) {
  return await saveTauriFile(zipBlob, filename, [
    { name: 'ZIP Archive', extensions: ['zip'] },
    { name: 'All Files', extensions: ['*'] }
  ])
}
