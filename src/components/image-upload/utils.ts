import { logger } from '@/utils/logger'

/**
 * Parse SVG viewBox attribute to extract dimensions
 */
function parseViewBoxDimensions(viewBox: string): {
  width: number
  height: number
} {
  const parts = viewBox.trim().split(/\s+|,/)

  if (parts.length !== 4) {
    throw new Error('Invalid viewBox format in SVG')
  }

  const w = parseFloat(parts[2])
  const h = parseFloat(parts[3])

  if (Number.isNaN(w) || Number.isNaN(h)) {
    throw new Error('Invalid viewBox dimensions in SVG')
  }

  return { width: w, height: h }
}

/**
 * Parse SVG width/height attributes to extract dimensions
 */
function parseWidthHeightAttributes(svg: SVGSVGElement): {
  width: number
  height: number
} {
  const widthAttr = svg.getAttribute('width')
  const heightAttr = svg.getAttribute('height')

  if (!widthAttr || !heightAttr) {
    throw new Error('No width/height attributes found in SVG')
  }

  // Remove units if present (e.g., "100px" -> "100")
  const w = parseInt(widthAttr, 10)
  const h = parseInt(heightAttr, 10)

  if (Number.isNaN(w) || Number.isNaN(h)) {
    throw new Error('Invalid width/height attributes in SVG')
  }

  return { width: w, height: h }
}

/**
 * Asynchronously extracts the width and height of an SVG file.
 *
 * This function reads the contents of the provided SVG file, parses it,
 * and attempts to determine its dimensions by first checking the `viewBox`
 * attribute, and then falling back to the `width` and `height` attributes if necessary.
 *
 * @param file - The SVG file from which to extract dimensions.
 * @returns A promise that resolves to an object containing the `width` and `height` of the SVG.
 * @throws Will throw an error if the SVG is invalid or if the dimensions cannot be determined.
 */
export const getSvgDimensions = async (file: File) => {
  const svgText = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = doc.querySelector('svg')

  if (!svg) {
    throw new Error('Invalid SVG file')
  }

  // Try viewBox first
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    return parseViewBoxDimensions(viewBox)
  }

  // Fallback: try width/height attributes
  return parseWidthHeightAttributes(svg)
}

/**
 * Processes an image file and invokes a callback with the loaded image.
 * Used for web browser environment only (Tauri uses native dialog)
 *
 * @param file - The image file to process.
 */
export const processImageFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Invalid image'))
      img.onload = () => resolve(img)

      img.src = reader.result as string
      
      if (file.type === 'image/svg+xml') {
        logger.debug('Processing SVG file')
        getSvgDimensions(file)
          .then((dimensions) => {
            img.width = dimensions.width
            img.height = dimensions.height
          })
          .catch((error) => reject(error instanceof Error ? error : new Error(String(error))))
      }
    }
    reader.readAsDataURL(file)
  })
}
