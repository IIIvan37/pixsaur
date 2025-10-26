/**
 * Tauri-specific file picker for image upload
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { logger } from '@/utils/logger'

/**
 * Open native file dialog and read selected image file
 * @returns Promise with image data URL or null if cancelled
 */
export async function pickImageFileTauri(): Promise<string | null> {
  try {
    // Open native file dialog
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        }
      ]
    })

    if (!selected) {
      // User cancelled
      return null
    }

    // Get file path (selected is a string when multiple: false)
    const filePath = selected as string

    // Read file content
    const contents = await readFile(filePath)

    // Detect MIME type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml'
    }
    const mimeType = mimeTypes[ext] || 'image/png'

    // Convert to base64 data URL
    const base64 = btoa(
      Array.from(new Uint8Array(contents))
        .map((byte) => String.fromCodePoint(byte))
        .join('')
    )

    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    logger.error('Failed to pick and read image file:', error)
    throw new Error('Failed to load image')
  }
}
