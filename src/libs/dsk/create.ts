/**
 * Create a minimal Amstrad CPC DSK disk image as a base for writing data.
 * @param filename The name of the disk (max 8 chars, padded with spaces)
 * @returns The DSK file as a base64 string
 */
export const createDsk = (filename: string): Uint8Array => {
  // DSK constants
  const NUM_TRACKS = 40
  const NUM_SIDES = 1
  const SECTORS_PER_TRACK = 9
  const SECTOR_SIZE = 512
  const TRACK_SIZE = 0x1300 // 4864 bytes per track (standard for CPCEMU DSK)

  const ascii = (str: string): Uint8Array => {
    const arr = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i)
    }
    return arr
  }

  // --- DSK Header (256 bytes) ---
  const header = new Uint8Array(256)
  // Signature
  const sig = 'MV - CPCEMU Disk-File\r\nDisk-Info\r\n'
  header.set(ascii(sig), 0)
  // Disk name (offset 0x22, 8 chars, padded)
  const diskName = filename.padEnd(8, ' ').slice(0, 8)
  header.set(ascii(diskName), 0x22)
  // Number of tracks (offset 0x30)
  header[0x30] = NUM_TRACKS
  // Number of sides (offset 0x31)
  header[0x31] = NUM_SIDES
  // Track size table (offset 0x34, 1 byte per track)
  for (let t = 0; t < NUM_TRACKS; t++) {
    // little-endian size for each track
    // Track size in little-endian (size in 256-byte blocks)
    header[0x34 + t] = TRACK_SIZE / 256 // low byte (since size always fits in one byte here)
  }

  console.log(' TRACK_SIZE / 256 ', TRACK_SIZE / 256)
  // --- Track Data (40 tracks, 1 side) ---
  const tracks = new Uint8Array(TRACK_SIZE * NUM_TRACKS)
  for (let trackNum = 0; trackNum < NUM_TRACKS; trackNum++) {
    const track = new Uint8Array(TRACK_SIZE)
    // Track header
    const trackSig = 'Track-Info\r\n'
    for (let i = 0; i < trackSig.length; i++) track[i] = trackSig.charCodeAt(i)
    // Track number (offset 0x10)
    track[0x10] = trackNum
    // Side number (offset 0x11)
    track[0x11] = 0
    // Data rate, recording mode, sector size, etc. (standard values)
    track[0x14] = 0x41 // sector size: 512 bytes
    track[0x15] = SECTORS_PER_TRACK
    track[0x16] = SECTOR_SIZE / 128 // 4 (512/128)
    // Fill sector info table (offset 0x18, 8 bytes per sector)
    for (let s = 0; s < SECTORS_PER_TRACK; s++) {
      const base = 0x18 + s * 8
      track[base + 0] = s + 1 // sector ID
      track[base + 1] = trackNum // track
      track[base + 2] = 0 // side
      track[base + 3] = 2 // size code (2 = 512 bytes)
      track[base + 4] = 0 // FDC status 1
      track[base + 5] = 0 // FDC status 2
      track[base + 6] = SECTOR_SIZE & 0xff
      track[base + 7] = SECTOR_SIZE >> 8
    }
    // Sector data (fill with 0xE5, standard for blank)
    track.fill(0xe5, 0x100)
    tracks.set(track, trackNum * TRACK_SIZE)
  }

  // --- Combine all parts ---
  const dsk = new Uint8Array(256 + TRACK_SIZE * NUM_TRACKS)
  dsk.set(header, 0)
  dsk.set(tracks, 256)

  // Return as base64 string (or use as ArrayBuffer/Blob as needed)
  return dsk
}
