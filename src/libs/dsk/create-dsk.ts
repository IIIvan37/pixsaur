const NUM_TRACKS = 40
const NUM_SIDES = 1
const SECTORS_PER_TRACK = 9
const SECTOR_SIZE = 512
const TRACK_SIZE = 0x1300 // 4864
const DSK_SIGNATURE = 'EXTENDED CPC DSK File\r\nDisk-Info\r\n'
const TRACK_SIGNATURE = 'Track-Info\r\n'

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s)

/**
 * Crée une piste valide avec table de secteurs + données
 */
function createTrack(trackNum: number, includeCatalog: boolean): Uint8Array {
  const track = new Uint8Array(TRACK_SIZE)

  // En-tête piste
  track.set(ascii(TRACK_SIGNATURE), 0)
  track[0x10] = trackNum
  track[0x11] = 0 // side
  track[0x15] = SECTORS_PER_TRACK
  track[0x16] = SECTOR_SIZE / 128 // = 4
  track[0x17] = 0xe5

  // Table de secteurs (72 octets)
  for (let i = 0; i < SECTORS_PER_TRACK; i++) {
    const sid = trackNum === 0 ? 0xc1 + i : 1 + i
    const off = 0x18 + i * 8
    track[off + 0] = sid
    track[off + 1] = trackNum
    track[off + 2] = 0 // side
    track[off + 3] = 2 // size code (512)
    track[off + 4] = 0
    track[off + 5] = 0
    track[off + 6] = SECTOR_SIZE & 0xff
    track[off + 7] = SECTOR_SIZE >> 8
  }

  // Remplissage des secteurs uniquement (ne pas écraser la table !)
  const catalog = new Uint8Array(2048).fill(0xe5)
  const dataStart = 256 + 72
  for (let i = 0; i < SECTORS_PER_TRACK; i++) {
    const sid = trackNum === 0 ? 0xc1 + i : 1 + i
    const offset = dataStart + i * SECTOR_SIZE

    if (includeCatalog && sid >= 0xc1 && sid <= 0xc4) {
      const index = sid - 0xc1
      track.set(
        catalog.slice(index * SECTOR_SIZE, (index + 1) * SECTOR_SIZE),
        offset
      )
    } else {
      track.fill(0xe5, offset, offset + SECTOR_SIZE)
    }
  }

  return track
}

/**
 * Crée un fichier DSK vierge et formaté
 */
export function createBlankDSK(diskName = 'PIXSAUR'): Uint8Array {
  const header = new Uint8Array(256)
  header.set(ascii(DSK_SIGNATURE), 0)
  header.set(ascii(diskName.padEnd(8, ' ').slice(0, 8)), 0x22)
  header[0x30] = NUM_TRACKS
  header[0x31] = NUM_SIDES
  for (let i = 0; i < NUM_TRACKS; i++) {
    header[0x34 + i] = TRACK_SIZE / 256
  }

  const dsk = new Uint8Array(256 + NUM_TRACKS * TRACK_SIZE)
  dsk.set(header, 0)
  for (let t = 0; t < NUM_TRACKS; t++) {
    const track = createTrack(t, t === 0)
    dsk.set(track, 256 + t * TRACK_SIZE)
  }

  return dsk
}
