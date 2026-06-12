// Typed contract for images between Source and Preview domains

export type SourceImage = HTMLImageElement

export type ProcessedImage = ImageData

export const isProcessedImage = (v: unknown): v is ProcessedImage => {
  return v instanceof ImageData
}

export const isSourceImage = (v: unknown): v is SourceImage => {
  return v instanceof HTMLImageElement
}
