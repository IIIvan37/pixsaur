import { createDsk } from './create-dsk'

const NUM_TRACKS = 40
const NUM_SIDES = 1
const SECTORS_PER_TRACK = 9
const SECTOR_SIZE = 512
const TRACK_SIZE = 0x1300 // 4864 bytes per track
const TRACK_HEADER_SIZE = 0x100 // 256 bytes (track header + sector info table)
const DSK_SIGNATURE = 'MV - CPCEMU Disk-File\r\nDisk-Info\r\n'
const TRACK_SIGNATURE = 'Track-Info\r\n'

describe('createDsk', () => {
  it('should return a Uint8Array', () => {
    const dsk = createDsk('TESTDISK')
    expect(dsk).toBeInstanceOf(Uint8Array)
  })

  it('should have correct DSK signature at the start of the file', () => {
    const dsk = createDsk('PIXSAUR')
    const actual = String.fromCharCode(...dsk.slice(0, DSK_SIGNATURE.length))
    expect(actual).toBe(DSK_SIGNATURE)
  })

  it('should pad or truncate disk name to 8 chars', () => {
    const dsk = createDsk('PIXSAUR123')
    const nameBytes = dsk.slice(0x22, 0x2a)
    const name = String.fromCharCode(...nameBytes)
    expect(name).toBe('PIXSAUR1')
  })

  it('should set correct number of tracks and sides in the header', () => {
    const dsk = createDsk('PIXSAUR')
    expect(dsk[0x30]).toBe(NUM_TRACKS)
    expect(dsk[0x31]).toBe(NUM_SIDES)
  })

  it('should set correct track size table in header', () => {
    const dsk = createDsk('PIXSAUR')
    for (let t = 0; t < NUM_TRACKS; t++) {
      expect(dsk[0x34 + t]).toBe(TRACK_SIZE / 256)
    }
  })

  it('should fill all sector data in every track with 0xE5 (blank sectors)', () => {
    const dsk = createDsk('PIXSAUR')
    for (let t = 0; t < NUM_TRACKS; t++) {
      const trackStart = 256 + t * TRACK_SIZE
      const sectorData = dsk.slice(
        trackStart + TRACK_HEADER_SIZE,
        trackStart + TRACK_SIZE
      )
      expect(sectorData.every((b) => b === 0xe5)).toBe(true)
    }
  })

  it('should have correct track signature for every track', () => {
    const dsk = createDsk('PIXSAUR')
    for (let t = 0; t < NUM_TRACKS; t++) {
      const trackStart = 256 + t * TRACK_SIZE
      const actual = String.fromCharCode(
        ...dsk.slice(trackStart, trackStart + TRACK_SIGNATURE.length)
      )
      expect(actual).toBe(TRACK_SIGNATURE)
    }
  })

  it('should have correct total DSK size', () => {
    const dsk = createDsk('PIXSAUR')
    expect(dsk.length).toBe(256 + NUM_TRACKS * TRACK_SIZE)
  })

  it('should set correct sector info table for each track', () => {
    const dsk = createDsk('PIXSAUR')
    for (let t = 0; t < NUM_TRACKS; t++) {
      const trackStart = 256 + t * TRACK_SIZE
      for (let s = 0; s < SECTORS_PER_TRACK; s++) {
        const base = trackStart + 0x18 + s * 8
        expect(dsk[base + 0]).toBe(s + 1) // sector ID
        expect(dsk[base + 1]).toBe(t) // track number
        expect(dsk[base + 2]).toBe(0) // side number
        expect(dsk[base + 3]).toBe(2) // size code (2 = 512 bytes)
        expect(dsk[base + 4]).toBe(0) // FDC status 1
        expect(dsk[base + 5]).toBe(0) // FDC status 2
        expect(dsk[base + 6]).toBe(SECTOR_SIZE & 0xff)
        expect(dsk[base + 7]).toBe(SECTOR_SIZE >> 8)
      }
    }
  })

  it('should handle empty or short disk names by padding with spaces', () => {
    const dsk = createDsk('A')
    const nameBytes = dsk.slice(0x22, 0x2a)
    const name = String.fromCharCode(...nameBytes)
    expect(name).toBe('A       ')
  })
})
