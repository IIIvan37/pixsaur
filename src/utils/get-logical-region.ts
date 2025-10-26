// src/utils/getLogicalRegion.ts
export function getLogicalRegion(
  visual: ImageData,
  logicalW: number
): ImageData {
  const logicalH = Math.min(200, visual.height)
  const out = new ImageData(logicalW, 200)
  const src = visual.data
  const dst = out.data

  for (let y = 0; y < logicalH; y++) {
    for (let x = 0; x < logicalW; x++) {
      const sx = x * 2
      const sIdx = (y * visual.width + sx) * 4
      const dIdx = (y * logicalW + x) * 4
      dst[dIdx] = src[sIdx]
      dst[dIdx + 1] = src[sIdx + 1]
      dst[dIdx + 2] = src[sIdx + 2]
      dst[dIdx + 3] = src[sIdx + 3]
    }
  }

  return out
}
