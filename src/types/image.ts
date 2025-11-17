// Typed contract for images between Source and Preview domains

export type SourceImage = HTMLImageElement

export type ProcessedImage = ImageData

export interface ConfiguredImage {
  // The original source element that originated the image
  readonly source: SourceImage

  // The processed image used by the preview and export pipeline
  readonly processed?: ProcessedImage | null

  // Optional metadata useful for export
  readonly filename?: string
  readonly mime?: string
}

export const isProcessedImage = (v: unknown): v is ProcessedImage => {
  return v instanceof ImageData
}

export const isSourceImage = (v: unknown): v is SourceImage => {
  return v instanceof HTMLImageElement
}
