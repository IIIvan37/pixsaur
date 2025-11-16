/**
 * AMSDOS filename utilities for CPC DSK format
 * Format: 8 characters maximum for name, 3 for extension, uppercase
 * Valid characters: A-Z, 0-9, underscore (_)
 */

export interface FilenameValidation {
  valid: boolean
  error?: string
}

/**
 * Validates if a filename follows AMSDOS 8.3 format rules
 * @param filename The filename to validate (with or without extension)
 * @returns Validation result with error message if invalid
 */
export function validateAmsdosFilename(filename: string): FilenameValidation {
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Filename cannot be empty' }
  }

  const parts = filename.split('.')

  // Must have exactly one extension
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Filename must have format NAME.EXT'
    }
  }

  const [name, ext] = parts

  // Check name length (max 8 chars)
  if (name.length === 0) {
    return { valid: false, error: 'Filename cannot be empty before extension' }
  }

  if (name.length > 8) {
    return {
      valid: false,
      error: `Name "${name}" exceeds 8 characters (${name.length} chars)`
    }
  }

  // Check extension length (max 3 chars)
  if (ext.length === 0) {
    return { valid: false, error: 'Extension cannot be empty' }
  }

  if (ext.length > 3) {
    return {
      valid: false,
      error: `Extension "${ext}" exceeds 3 characters (${ext.length} chars)`
    }
  }

  // Check valid characters (A-Z, 0-9, underscore)
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

/**
 * Sanitizes a filename to conform to AMSDOS 8.3 format
 * - Converts to uppercase
 * - Removes invalid characters
 * - Truncates to 8.3 limit
 * - Replaces spaces with underscores
 *
 * @param filename The filename to sanitize
 * @param defaultExt Default extension to use if none provided (default: 'SCR')
 * @returns Sanitized filename in AMSDOS format
 */
export function sanitizeAmsdosFilename(
  filename: string,
  defaultExt = 'SCR'
): string {
  if (!filename || filename.trim() === '') {
    return `FILE.${defaultExt}`
  }

  let name: string
  let ext: string

  // Split on last dot to handle edge cases
  const lastDotIndex = filename.lastIndexOf('.')

  if (lastDotIndex === -1) {
    // No extension provided
    name = filename
    ext = defaultExt
  } else {
    name = filename.substring(0, lastDotIndex)
    ext = filename.substring(lastDotIndex + 1)
  }

  // Convert to uppercase
  name = name.toUpperCase()
  ext = ext.toUpperCase()

  // Replace spaces with underscores, then keep only valid characters
  const cleanChar = (c: string): string => {
    if (/[A-Z0-9_]/.test(c)) return c
    if (/\s/.test(c)) return '_'
    return ''
  }

  name = name.split('').map(cleanChar).join('')
  ext = ext.split('').map(cleanChar).join('')

  // Truncate to limits
  name = name.substring(0, 8)
  ext = ext.substring(0, 3)

  // Ensure we have something
  if (name === '') {
    name = 'FILE'
  }
  if (ext === '') {
    ext = defaultExt
  }

  return `${name}.${ext}`
}

/**
 * Generates a sequential filename for DSK workspace images
 * Format: IMG01.SCR, IMG02.SCR, etc.
 *
 * @param index 1-based index for the image
 * @returns AMSDOS-compliant filename
 */
export function generateDskImageFilename(index: number): string {
  // No padding: use straightforward IMG{n}.SCR to keep filenames shorter
  // e.g., IMG1.SCR, IMG10.SCR, IMG12345.SCR
  return `IMG${index}.SCR`
}
