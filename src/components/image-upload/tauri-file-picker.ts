/**
 * Tauri-specific file picker for image upload
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { logger } from '@/utils/core'
import { invariant } from '@/utils/invariant'

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
    invariant(typeof selected === 'string', 'Expected a single file path')

    // Read file content
    const contents = await readFile(selected)

    // Detect MIME type from file extension
    const ext = selected.split('.').pop()?.toLowerCase() || ''
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

/**
 * Open native file dialog and return a File object compatible with browser APIs
 * This mirrors the behavior used by ImageUpload's processFile so we can reuse
 * existing logic without mounting the dropzone.
 */
export async function pickImageFileTauriAsFile(): Promise<File | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']
        }
      ]
    })

    if (!selected) return null

    invariant(typeof selected === 'string', 'Expected a single file path')

    const contents = await readFile(selected)
    const fileName = selected.split('/').pop() || 'image'
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
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

    // Create a File from the read content so we can reuse browser loaders
    const file = new File([contents], fileName, { type: mimeType })
    return file
  } catch (error) {
    logger.error('Failed to pick and read image file:', error)
    throw new Error('Failed to load image')
  }
}
