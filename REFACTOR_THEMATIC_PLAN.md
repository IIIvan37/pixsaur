### Source (detailed)

Source is the place where the image is made available to the rest of the app. That includes: selecting the source (file / clipboard / example), adjusting the image dimensions or selection rectangle, and applying local adjustments (brightness, contrast, r/g/b multipliers, exposure, gamma).

Responsibilities
- Input adapters (file picker, Tauri file picker, clipboard)
- Pre-normalization (downscale/upscale to mode; crop/selection)
- Image adjustments UI (RGB sliders, exposure, contrast) — keep business logic here
- Selection rectangle & custom dimensions (coordinate math, validation)
- Expose a `ConfiguredImage` that includes the normalized pixel buffer and settings

Example Source API contract
```ts
type Selection = { x: number; y: number; width: number; height: number }
type Adjustments = { r: number; g: number; b: number; exposure: number; contrast: number }

interface ConfiguredImage {
	width: number
	height: number
	sourceType: 'file' | 'clipboard' | 'example'
	pixels: Uint8ClampedArray
	adjustments?: Adjustments
	selection?: Selection
}

// Source produces a configured image object
function configureSource(image: HTMLImageElement | ImageData, opts: { dims?: {w,h}; selection?: Selection; adjustments?: Adjustments }): ConfiguredImage
```

### Preview (detailed)

Preview consumes the `ConfiguredImage` produced by Source. It is the responsibility of Preview to apply color-space conversions, dithering and quantization and to render a preview image for the UI. Preview also contains caches and possibly worker-wrappers for heavy computations. Preview's inputs MUST be deterministic — same `ConfiguredImage` must produce same preview.

Responsibilities
- Accept `ConfiguredImage` as input (with valid width/height) — resize/crop already handled by Source
- Compute `ProcessedImage` including palette indices, preview pixels, and metadata like histogram and average color
- Rendering helpers for the preview layer (e.g., square pixels for CPC modes)

Example Preview API contract
```ts
type ProcessedImage = {
	width: number
	height: number
	pixels: Uint8ClampedArray // e.g., RGBA for display
	paletteIndices?: Uint8Array // optional pre-quantized palette indices
	metrics?: { histogram: number[] }
}

function processConfiguredImage(cfg: ConfiguredImage, options: PreviewOptions): Promise<ProcessedImage>
```

Notes
- Keep `useImageAdjustement()` in Source (as you suggested), it manipulates the `ConfiguredImage` state.
- `useImageProcessors()` may live in Preview — it wires heavy CPU/GPU operations and returns a processed result.

# Thematic refactor plan: Source / Preview / Export

This document outlines how to regroup the codebase around three main themes the project shows naturally:

- Source: managing image input (selectors, uploaders, adapters) — all code concerned with how images are sourced into the system
- Preview: all image processing and UI previews, plus algorithms used to transform and display images (resizing, dithering, quantization, preview store)
- Export: everything that produces final outputs and file formats (export to DSK, PNG, ZIP, assembly code, etc.)

Goal: reduce `utils` as a container