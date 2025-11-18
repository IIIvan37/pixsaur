/**
 * AMSDOS filename utilities for CPC DSK format
 * Format: 8 characters maximum for name, 3 for extension, uppercase
 * Valid characters: A-Z, 0-9, underscore (_)
 */

export interface FilenameValidation {
  valid: boolean
  error?: string
}

export function validateAmsdosFilename(filename: string): FilenameValidation {
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Filename cannot be empty' }
  }

  const parts = filename.split('.')

  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Filename must have format NAME.EXT'
    }
  }

  const [name, ext] = parts

  if (name.length === 0) {
    return { valid: false, error: 'Filename cannot be empty before extension' }
  }

  if (name.length > 8) {
    return {
      valid: false,
      error: `Name "${name}" exceeds 8 characters (${name.length} chars)`
    }
  }

  if (ext.length === 0) {
    return { valid: false, error: 'Extension cannot be empty' }
  }

  if (ext.length > 3) {
    return {
      valid: false,
      error: `Extension "${ext}" exceeds 3 characters (${ext.length} chars)`
    }
  }

  const validCharsRegex = /^[A-Z0-9_]+$/

  if (!validCharsRegex.test(name)) {
    return {
      valid: false,
      error: 'Name can only contain A-Z, 0-9, and underscore'
    }
  }

  if (!validCharsRegex.test(ext)) {
    return {
      valid: false,
      error: 'Extension can only contain A-Z, 0-9, and underscore'
    }
  }

  return { valid: true }
}

export function sanitizeAmsdosFilename(
  filename: string,
  defaultExt = 'SCR'
): string {
  if (!filename || filename.trim() === '') {
    return `FILE.${defaultExt}`
  }

  let name: string
  let ext: string

  const lastDotIndex = filename.lastIndexOf('.')

  if (lastDotIndex === -1) {
    name = filename
    ext = defaultExt
  } else {
    name = filename.substring(0, lastDotIndex)
    ext = filename.substring(lastDotIndex + 1)
  }

  name = name.toUpperCase()
  ext = ext.toUpperCase()

  const cleanChar = (c: string): string => {
    if (/[A-Z0-9_]/.test(c)) return c
    if (/\s/.test(c)) return '_'
    return ''
  }

  name = name.split('').map(cleanChar).join('')
  ext = ext.split('').map(cleanChar).join('')

  name = name.substring(0, 8)
  ext = ext.substring(0, 3)

  if (name === '') name = 'FILE'
  if (ext === '') ext = defaultExt

  return `${name}.${ext}`
}

export function generateDskImageFilename(index: number): string {
  return `IMG${index}.SCR`
}
