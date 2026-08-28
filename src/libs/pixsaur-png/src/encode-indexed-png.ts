/**
 * Minimal indexed-colour PNG encoder.
 *
 * Deliberately emits **uncompressed** zlib stored blocks rather than pulling in
 * a deflate dependency: the output is a fully valid PNG, the encoder stays pure
 * and trivially deterministic (the guarantee the tileset slice rests on), and
 * real deflate can be swapped in later without touching this interface.
 * Recorded as v2 debt in `docs/features/PLAN-tileset-workshop.md`.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const COLOUR_TYPE_INDEXED = 3
/** A stored deflate block carries at most 65535 bytes. */
const MAX_STORED_BLOCK = 0xffff
const ADLER_MODULO = 65521

export interface IndexedImage {
  width: number
  height: number
  /** Up to 256 RGB pens; `indices` are positions in this array. */
  palette: [r: number, g: number, b: number][]
  /** One byte per pixel, row-major, `width * height` long. */
  indices: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % ADLER_MODULO
    b = (b + a) % ADLER_MODULO
  }
  return ((b << 16) | a) >>> 0
}

function chunk(type: string, data: Uint8Array): number[] {
  const typed = new Uint8Array(4 + data.length)
  for (let i = 0; i < 4; i++) typed[i] = type.charCodeAt(i)
  typed.set(data, 4)

  const crc = crc32(typed)
  return [...beUint32(data.length), ...typed, ...beUint32(crc)]
}

function beUint32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]
}

/** Wrap `raw` in a zlib stream made of uncompressed deflate blocks. */
function zlibStored(raw: Uint8Array): number[] {
  const out: number[] = [0x78, 0x01]

  for (let at = 0; at < raw.length || at === 0; at += MAX_STORED_BLOCK) {
    const length = Math.min(MAX_STORED_BLOCK, raw.length - at)
    const isFinal = at + length >= raw.length
    out.push(
      isFinal ? 1 : 0,
      length & 0xff,
      (length >>> 8) & 0xff,
      ~length & 0xff,
      (~length >>> 8) & 0xff,
      ...raw.subarray(at, at + length)
    )
    if (isFinal) break
  }

  out.push(...beUint32(adler32(raw)))
  return out
}

/** Prefix every scanline with filter type 0 (None), as PNG requires. */
function toScanlines(image: IndexedImage): Uint8Array {
  const { width, height, indices } = image
  const raw = new Uint8Array(height * (width + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0
    raw.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1)
  }
  return raw
}

export function encodeIndexedPng(image: IndexedImage): Uint8Array {
  const ihdr = new Uint8Array([
    ...beUint32(image.width),
    ...beUint32(image.height),
    8, // bit depth
    COLOUR_TYPE_INDEXED,
    0, // compression: deflate
    0, // filter method
    0 // no interlace
  ])

  const plte = new Uint8Array(image.palette.length * 3)
  image.palette.forEach(([r, g, b], index) => {
    plte.set([r, g, b], index * 3)
  })

  return new Uint8Array([
    ...SIGNATURE,
    ...chunk('IHDR', ihdr),
    ...chunk('PLTE', plte),
    ...chunk('IDAT', new Uint8Array(zlibStored(toScanlines(image)))),
    ...chunk('IEND', new Uint8Array(0))
  ])
}
