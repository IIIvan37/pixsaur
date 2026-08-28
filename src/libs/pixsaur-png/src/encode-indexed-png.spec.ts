import { encodeIndexedPng } from './encode-indexed-png'

/** A 2×2 image using two pens. */
const image = {
  width: 2,
  height: 2,
  palette: [
    [255, 0, 0],
    [0, 0, 255]
  ] as [number, number, number][],
  indices: new Uint8Array([0, 1, 1, 0])
}

/** Split a PNG into its chunks: `{ type, data }` in file order. */
function readChunks(png: Uint8Array): { type: string; data: Uint8Array }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks: { type: string; data: Uint8Array }[] = []
  let at = 8 // skip the signature
  while (at < png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    chunks.push({ type, data: png.subarray(at + 8, at + 8 + length) })
    at += 12 + length
  }
  return chunks
}

/** Undo the zlib stored-block framing: 2-byte header, blocks, adler-32. */
function inflateStored(zlib: Uint8Array): Uint8Array {
  const out: number[] = []
  let at = 2
  for (;;) {
    const final = zlib[at] & 1
    const length = zlib[at + 1] | (zlib[at + 2] << 8)
    out.push(...zlib.subarray(at + 5, at + 5 + length))
    at += 5 + length
    if (final) break
  }
  return new Uint8Array(out)
}

describe('encodeIndexedPng', () => {
  it('starts with the PNG signature', () => {
    const png = encodeIndexedPng(image)

    expect(Array.from(png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10
    ])
  })

  it('emits the chunks a viewer expects, in order', () => {
    const png = encodeIndexedPng(image)

    expect(readChunks(png).map((chunk) => chunk.type)).toEqual([
      'IHDR',
      'PLTE',
      'IDAT',
      'IEND'
    ])
  })

  it('declares the indexed-colour type in IHDR', () => {
    const png = encodeIndexedPng(image)
    const ihdr = readChunks(png)[0].data

    expect(ihdr[9]).toBe(3)
  })

  it('writes each pen into PLTE', () => {
    const png = encodeIndexedPng(image)
    const plte = readChunks(png)[1].data

    expect(Array.from(plte)).toEqual([255, 0, 0, 0, 0, 255])
  })

  it('writes every scanline behind a zero filter byte', () => {
    const png = encodeIndexedPng(image)
    const raw = inflateStored(readChunks(png)[2].data)

    expect(Array.from(raw)).toEqual([0, 0, 1, 0, 1, 0])
  })

  it('marks the named pen transparent in tRNS', () => {
    const png = encodeIndexedPng({ ...image, transparentIndex: 0 })
    const trns = readChunks(png).find((chunk) => chunk.type === 'tRNS')

    expect(trns && Array.from(trns.data)).toEqual([0])
  })
})
