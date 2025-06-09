/**
 * Create a minimal Amstrad CPC DSK disk image as a base for writing data.
 * @param filename The name of the disk (max 8 chars, padded with spaces; longer names will be truncated)
 * @returns The DSK file as a Uint8Array (raw binary image)
 *
 * Note: If the filename is longer than 8 characters, it will be truncated.
 *       All sectors are filled with 0xE5 (blank). This is a single-sided, 40-track, 9-sector/track, 512 bytes/sector disk.
 */

const NUM_TRACKS = 40
const NUM_SIDES = 2
const SECTORS_PER_TRACK = 9
const SECTOR_SIZE = 512
const TRACK_SIZE = 0x1300 // 4864 bytes per track (standard for CPCEMU DSK)
const TRACK_HEADER_SIZE = 0x100 // 256 bytes (track header + sector info table)
const DSK_SIGNATURE = 'MV - CPCEMU Disk-File\r\nDisk-Info\r\n'
const TRACK_SIGNATURE = 'Track-Info\r\n'

/**
 * Convert an ASCII string to a Uint8Array.
 */
const ascii = (str: string): Uint8Array => {
  const arr = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i)
  return arr
}

/**
 * Create the 256-byte DSK header.
 */
function createDskHeader(filename: string): Uint8Array {
  const header = new Uint8Array(256)
  header.set(ascii(DSK_SIGNATURE), 0)
  // Disk name (offset 0x22, 8 chars, padded/truncated)
  const diskName = filename.padEnd(8, ' ').slice(0, 8)
  header.set(ascii(diskName), 0x22)
  header[0x30] = NUM_TRACKS
  header[0x31] = NUM_SIDES
  // Track size table (offset 0x34, 1 byte per track)
  for (let t = 0; t < NUM_TRACKS; t++) {
    header[0x34 + t] = TRACK_SIZE / 256 // 0x13 (4864/256)
  }
  return header
}

/**
 * Create a single track (with header, sector info, and blank sector data).
 */
function createTrack(trackNum: number): Uint8Array {
  const track = new Uint8Array(TRACK_SIZE)
  track.set(ascii(TRACK_SIGNATURE), 0)
  track[0x10] = trackNum
  track[0x11] = 0
  track[0x14] = 0x41 // sector size: 512 bytes
  track[0x15] = SECTORS_PER_TRACK
  track[0x16] = SECTOR_SIZE / 128 // 4 (512/128)
  // Fill sector info table (offset 0x18, 8 bytes per sector)
  for (let s = 0; s < SECTORS_PER_TRACK; s++) {
    const base = 0x18 + s * 8
    // --- FIX: Use AMSDOS sector IDs ---
    const sectorId = trackNum === 0 ? 0xc1 + s : s + 1
    track[base + 0] = sectorId // sector ID
    track[base + 1] = trackNum // track
    track[base + 2] = 0 // side
    track[base + 3] = 2 // size code (2 = 512 bytes)
    track[base + 4] = 0 // FDC status 1
    track[base + 5] = 0 // FDC status 2
    track[base + 6] = SECTOR_SIZE & 0xff
    track[base + 7] = SECTOR_SIZE >> 8
  }
  track.fill(0xe5, TRACK_HEADER_SIZE)
  if (trackNum === 0) {
    track.fill(0xe5, TRACK_HEADER_SIZE, TRACK_HEADER_SIZE + 2 * SECTOR_SIZE)
  }
  return track
}

/**
 * Create a blank Amstrad CPC DSK image.
 */
export const createDsk = (filename: string): Uint8Array => {
  const header = createDskHeader(filename)
  const tracks = new Uint8Array(TRACK_SIZE * NUM_TRACKS)
  for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
    tracks.set(createTrack(trackNum), trackNum * TRACK_SIZE)
  }
  const dsk = new Uint8Array(256 + TRACK_SIZE * NUM_TRACKS)
  dsk.set(header, 0)
  dsk.set(tracks, 256)
  return dsk
}
