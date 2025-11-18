// Implementation moved from utils -> preview domain
export function applyHorizontalSmoothing(
  imageData: ImageData,
  pixelWidth: number
): ImageData {
  const { width, height, data } = imageData
  const smoothed = new ImageData(width, height)

  if (pixelWidth <= 1) {
    smoothed.data.set(data)
    return smoothed
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const destIdx = (y * width + x) * 4
      const samplesLeft = Math.floor((pixelWidth - 1) / 2)
      const samplesRight = Math.ceil((pixelWidth - 1) / 2)

      const startX = Math.max(0, x - samplesLeft)
      const endX = Math.min(width - 1, x + samplesRight)
      const sampleCount = endX - startX + 1

      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sx = startX; sx <= endX; sx++) {
        const srcIdx = (y * width + sx) * 4
        r += data[srcIdx]
        g += data[srcIdx + 1]
        b += data[srcIdx + 2]
        a += data[srcIdx + 3]
      }

      smoothed.data[destIdx] = Math.round(r / sampleCount)
      smoothed.data[destIdx + 1] = Math.round(g / sampleCount)
      smoothed.data[destIdx + 2] = Math.round(b / sampleCount)
      smoothed.data[destIdx + 3] = Math.round(a / sampleCount)
    }
  }

  return smoothed
}

export function getPixelWidthForMode(mode: number): number {
  switch (mode) {
    case 0:
      return 4
    case 1:
      return 2
    default:
      return 1
  }
}
