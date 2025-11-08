/**
 * Calculate the SCR file size
 * SCR files are always 16384 bytes (16 KB) for CPC screen memory
 * @returns SCR data size in bytes (always 16384)
 */
export function calculateScrSize(): number {
  // CPC SCR format is always 16KB (screen memory from &C000 to &FFFF)
  return 16384
}

/**
 * Calculate the size of linear data for custom dimensions
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param mode - CPC mode (0, 1, or 2)
 * @returns Size in bytes
 */
export function calculateLinearSize(
  width: number,
  height: number,
  mode: number
): number {
  const pixelsPerByte = mode === 0 ? 2 : mode === 1 ? 4 : 8
  const widthInBytes = Math.floor(width / pixelsPerByte)
  return widthInBytes * height
}

/**
 * Check if image dimensions are standard (non-custom)
 * @param width - Image width
 * @param height - Image height
 * @param mode - CPC mode
 * @param overscan - Is overscan mode
 * @returns True if standard dimensions
 */
export function isStandardMode(
  width: number,
  height: number,
  mode: number,
  overscan: boolean
): boolean {
  if (overscan) return false

  return (
    (mode === 0 && width === 160 && height === 200) ||
    (mode === 1 && width === 320 && height === 200) ||
    (mode === 2 && width === 640 && height === 200)
  )
}

/**
 * Calculate number of chunks needed for data
 * @param dataSize - Size of data in bytes
 * @returns Number of chunks (1 if <= 16KB, 2+ if larger)
 */
export function calculateChunkCount(dataSize: number): number {
  const MAX_CHUNK_SIZE = 16 * 1024 // 16 KB
  return Math.ceil(dataSize / MAX_CHUNK_SIZE)
}

/**
 * Generate DSK filenames for an image (may be multiple chunks)
 * @param imageIndex - 1-based index
 * @param width - Image width
 * @param height - Image height
 * @param mode - CPC mode
 * @param overscan - Is overscan
 * @returns Array of filenames
 */
export function generateDskFilenames(
  imageIndex: number,
  width: number,
  height: number,
  mode: number,
  overscan: boolean
): string[] {
  const isStandard = isStandardMode(width, height, mode, overscan)

  if (isStandard) {
    return [`IMG${imageIndex}.SCR`]
  }

  // Custom dimensions - calculate chunks
  const linearSize = calculateLinearSize(width, height, mode)
  const chunkCount = calculateChunkCount(linearSize)

  if (chunkCount === 1) {
    return [`IMG${imageIndex}.BIN`]
  }

  // Multiple chunks - use shorter base name to fit AMSDOS 8.3 limit
  // IMG1_1.BIN fits in 8 chars (IMG + index + _ + chunk number)
  return Array.from(
    { length: chunkCount },
    (_, i) => `IMG${imageIndex}_${i + 1}.BIN`
  )
}

/**
 * Standard DSK size in bytes
 * 9 tracks × 2 sides × 512 bytes per sector × 9 sectors per track = 184320 bytes (180 KB)
 */
export const DSK_TOTAL_SIZE = 184320

/**
 * DSK catalog size in bytes (2 KB reserved for directory)
 */
export const DSK_CATALOG_SIZE = 2048

/**
 * DSK loader size in bytes (1 KB reserved for loader program)
 */
export const DSK_LOADER_SIZE = 1024

/**
 * Available DSK size for files (177 KB)
 * Total - Catalog - Loader = 180 KB - 2 KB - 1 KB = 177 KB
 */
export const DSK_AVAILABLE_SIZE =
  DSK_TOTAL_SIZE - DSK_CATALOG_SIZE - DSK_LOADER_SIZE // 181248 bytes = 177 KB

/**
 * Calculate remaining space on a DSK
 * @param images - Array of images with scrData
 * @returns Remaining space in bytes
 */
export function calculateDskRemainingSpace(
  images: Array<{ scrData: Uint8Array | number[] }>
): number {
  // Calculate total used space (each file = 16384 bytes + 128 bytes AMSDOS header)
  const usedSpace = images.reduce((total) => {
    const fileSize = calculateScrSize() + 128 // SCR data + AMSDOS header
    return total + fileSize
  }, 0)

  return DSK_AVAILABLE_SIZE - usedSpace
}

/**
 * Check if there is enough space to add a new image to the DSK
 * @param images - Current array of images
 * @returns True if there is enough space for one more image
 */
export function canAddImageToDsk(
  images: Array<{ scrData: Uint8Array | number[] }>
): boolean {
  const remaining = calculateDskRemainingSpace(images)
  const fileSize = calculateScrSize() + 128 // 16512 bytes
  return remaining >= fileSize
}

/**
 * Format DSK space in kilobytes
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "163 Ko")
 */
export function formatDskSpace(bytes: number): string {
  const kb = Math.floor(bytes / 1024)
  return `${kb} Ko`
}

/**
 * Format the size of SCR data in kilobytes
 * Includes 128 bytes AMSDOS header and rounds up to next KB
 * @param scrDataLength - The length of the scrData array
 * @returns Formatted string with size in Ko (e.g., "17 Ko" for 16KB SCR + 128 bytes header)
 */
export function formatScrSize(scrDataLength: number): string {
  // Add 128 bytes for AMSDOS header
  const totalSizeBytes = scrDataLength + 128
  // Convert to KB and round up
  const totalSizeKb = Math.ceil(totalSizeBytes / 1024)
  return `${totalSizeKb} Ko`
}

/**
 * Format image dimensions
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Formatted string (e.g., "320×200")
 */
export function formatImageSize(width: number, height: number): string {
  return `${width}×${height}`
}

/**
 * Get display label for CPC screen mode
 * @param mode - CPC screen mode (0, 1, or 2)
 * @returns Mode label string
 */
export function getModeLabel(mode: number): string {
  switch (mode) {
    case 0:
      return 'Mode 0'
    case 1:
      return 'Mode 1'
    case 2:
      return 'Mode 2'
    default:
      return `Mode ${mode}`
  }
}
