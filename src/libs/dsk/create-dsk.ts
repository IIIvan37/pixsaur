const NUM_TRACKS = 40
const NUM_SIDES = 1
const SECTORS_PER_TRACK = 9
const SECTOR_SIZE = 512
const TRACK_SIZE = 0x1300 // 4864 bytes
const DSK_SIGNATURE = 'EXTENDED CPC DSK File\r\nDisk-Info\r\n'
const TRACK_SIGNATURE = 'Track-Info\r\n'

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s)

/**
 * Crée une piste valide avec table de secteurs et données remplies à 0xE5.
 * Injecte un catalogue dans les secteurs C1 à C4 de la piste 0 si demandé.
 */
function createTrack(trackNum: number, includeCatalog: boolean): Uint8Array {
  const track = new Uint8Array(TRACK_SIZE)

  // En-tête
  track.set(ascii(TRACK_SIGNATURE), 0)
  track[0x10] = trackNum
  track[0x11] = 0 // side
  track[0x15] = SECTORS_PER_TRACK
  track[0x16] = SECTOR_SIZE / 128 // = 4
  track[0x17] = 0xe5

  // Table des secteurs
  for (let i = 0; i < SECTORS_PER_TRACK; i++) {
    const sid = trackNum === 0 ? 0xc1 + i : i + 1
    const off = 0x18 + i * 8
    track[off + 0] = sid
    track[off + 1] = trackNum
    track[off + 2] = 0 // side
    track[off + 3] = 2 // size code = 512
    track[off + 4] = 0
    track[off + 5] = 0
    track[off + 6] = SECTOR_SIZE & 0xff
    track[off + 7] = SECTOR_SIZE >> 8
  }

  // Données des secteurs
  const catalog = new Uint8Array(2048).fill(0xe5)
  const sectorDataStart = 256 + 72

  for (let i = 0; i < SECTORS_PER_TRACK; i++) {
    const sid = trackNum === 0 ? 0xc1 + i : i + 1
    const dataOffset = sectorDataStart + i * SECTOR_SIZE

    if (includeCatalog && sid >= 0xc1 && sid <= 0xc4) {
      const index = sid - 0xc1
      track.set(
        catalog.slice(index * SECTOR_SIZE, (index + 1) * SECTOR_SIZE),
        dataOffset
      )
    } else {
      track.fill(0xe5, dataOffset, dataOffset + SECTOR_SIZE)
    }
  }

  return track
}

/**
 * Crée un disque DSK Amstrad CPC formaté vide.
 */
export function createBlankDSK(diskName = 'PIXSAUR'): Uint8Array {
  const header = new Uint8Array(256).fill(0)
  header.set(ascii(DSK_SIGNATURE), 0)
  header.set(ascii(diskName.padEnd(8, ' ').slice(0, 8)), 0x22)
  header[0x30] = NUM_TRACKS
  header[0x31] = NUM_SIDES
  for (let i = 0; i < NUM_TRACKS; i++) {
    header[0x34 + i] = TRACK_SIZE / 256 // 0x13
  }

  const dsk = new Uint8Array(256 + NUM_TRACKS * TRACK_SIZE)
  dsk.set(header, 0)

  for (let t = 0; t < NUM_TRACKS; t++) {
    const track = createTrack(t, t === 0)
    dsk.set(track, 256 + t * TRACK_SIZE)
  }

  return dsk
}
