const NUM_TRACKS = 40
const SECTORS_PER_TRACK = 9
const SECTOR_SIZE = 512
const TRACK_SIZE = 0x1300
const TRACK_HEADER_SIZE = 0x100

type FileToAdd = {
  filename: string // 8+3 chars, e.g. "MYDATA  BIN"
  data: Uint8Array
  amsdosHeader?: Uint8Array // Optional: 128-byte AMSDOS header
}

/**
 * Find all free sectors on the disk (returns [{track, sectorId}])
 */
function findFreeSectors(
  dsk: Uint8Array
): { track: number; sectorId: number }[] {
  const free: { track: number; sectorId: number }[] = []
  for (let t = 0; t < NUM_TRACKS; t++) {
    for (let s = 0; s < SECTORS_PER_TRACK; s++) {
      // Skip directory sectors (track 0, sectors 0 and 1)
      if (t === 0 && (s === 0 || s === 1)) continue
      const sectorOffset =
        256 + t * TRACK_SIZE + TRACK_HEADER_SIZE + s * SECTOR_SIZE
      const sector = dsk.slice(sectorOffset, sectorOffset + SECTOR_SIZE)
      if (sector.every((b) => b === 0xe5)) {
        free.push({ track: t, sectorId: s + 1 }) // sectorId is 1-based (1..9)
      }
    }
  }
  return free
}

/**
 * Add multiple AMSDOS-compatible files to a DSK image.
 * Large files are split into extents (multiple directory entries).
 */
export function addAmsdosFilesToDsk(
  dsk: Uint8Array,
  files: FileToAdd[]
): Uint8Array {
  const dirStart = 256 + 0 * TRACK_SIZE + TRACK_HEADER_SIZE
  const dirEnd = dirStart + 2 * SECTOR_SIZE
  const blocksPerExtent = 16
  const blockSize = SECTOR_SIZE

  let freeSectors = findFreeSectors(dsk)

  for (const file of files) {
    // Prepend AMSDOS header if provided
    const fileData = file.amsdosHeader
      ? new Uint8Array([...file.amsdosHeader, ...file.data])
      : file.data

    const extentCount = Math.ceil(
      fileData.length / (blocksPerExtent * blockSize)
    )
    let written = 0

    for (let extent = 0; extent < extentCount; extent++) {
      // Find free directory entry
      let entryOffset = -1
      for (let offset = dirStart; offset < dirEnd; offset += 32) {
        if (dsk.slice(offset, offset + 32).every((b) => b === 0xe5)) {
          entryOffset = offset
          break
        }
      }
      if (entryOffset === -1) throw new Error('No free directory entry found')

      // Allocate up to 16 sectors for this extent
      const blocksThisExtent = Math.min(
        blocksPerExtent,
        Math.ceil((fileData.length - written) / blockSize)
      )
      const allocated = freeSectors.slice(0, blocksThisExtent)
      freeSectors = freeSectors.slice(blocksThisExtent)

      // Write directory entry
      const name = file.filename.padEnd(11, ' ').slice(0, 11)
      for (let i = 0; i < 8; i++) dsk[entryOffset + i] = name.charCodeAt(i)
      for (let i = 0; i < 3; i++)
        dsk[entryOffset + 8 + i] = name.charCodeAt(8 + i)
      dsk[entryOffset + 11] = 0x00 // File type: binary (adjust if needed)
      dsk[entryOffset + 12] = extent // Extent number
      dsk[entryOffset + 13] = 0x00 // First block (not used for binary)
      dsk[entryOffset + 14] = 0x00 // Unused
      dsk[entryOffset + 15] = 0x00 // Unused

      // Block allocation table
      for (let i = 0; i < allocated.length; i++) {
        dsk[entryOffset + 16 + i * 2] = allocated[i].track
        dsk[entryOffset + 17 + i * 2] = allocated[i].sectorId
      }
      for (let i = allocated.length; i < 16; i++) {
        dsk[entryOffset + 16 + i * 2] = 0
        dsk[entryOffset + 17 + i * 2] = 0
      }

      // File length (little endian, bytes 30-31) — only set for the last extent
      const chunkSize = Math.min(
        fileData.length - written,
        blocksThisExtent * blockSize
      )
      dsk[entryOffset + 30] = chunkSize & 0xff
      dsk[entryOffset + 31] = chunkSize >> 8

      // Write file data to allocated sectors
      for (let i = 0; i < allocated.length; i++) {
        const { track, sectorId } = allocated[i]
        const sectorOffset =
          256 +
          track * TRACK_SIZE +
          TRACK_HEADER_SIZE +
          (sectorId - 1) * SECTOR_SIZE
        dsk.set(fileData.slice(written, written + blockSize), sectorOffset)
        written += blockSize
        if (written >= fileData.length) break
      }
    }
  }
  return dsk
}
