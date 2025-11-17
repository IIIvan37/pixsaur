import { open, readFile } from '@/tauri'
import { logger } from '@/utils/core'
import { invariant } from '@/utils/invariant'

export async function pickImageFileTauri(): Promise<string | null> {
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

    const file = new File([contents], fileName, { type: mimeType })
    return file
  } catch (error) {
    logger.error('Failed to pick and read image file:', error)
    throw new Error('Failed to load image')
  }
}
