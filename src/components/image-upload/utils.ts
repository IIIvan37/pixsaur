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
  if (svg) {
    // Try viewBox first
    const viewBox = svg.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+|,/)

      if (parts.length === 4) {
        const w = parseFloat(parts[2])
        const h = parseFloat(parts[3])
        console.log('w', w, 'h', h)
        if (!isNaN(w) && !isNaN(h)) {
          return { width: w, height: h }
        }
      }
      throw new Error('Invalid viewBox dimensions in SVG')
    }

    // Fallback: try width/height attributes
    const widthAttr = svg.getAttribute('width')
    const heightAttr = svg.getAttribute('height')
    if (widthAttr && heightAttr) {
      // Remove units if present (e.g., "100px" -> "100")
      const w = parseInt(widthAttr)
      const h = parseInt(heightAttr)
      if (!isNaN(w) && !isNaN(h)) {
        return { width: w, height: h }
      }
      throw new Error('Invalid width/height attributes in SVG')
    }

    throw new Error('No viewBox or width/height attributes found in SVG')
  }
  throw new Error('Invalid SVG file')
}

/**
 * Processes an image file and invokes a callback with the loaded image.
 *
 * @param file - The image file to process.
 * @param onImageLoaded - Callback function to be called with the loaded image.
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
        console.log('Processing SVG file')
        getSvgDimensions(file)
          .then((dimensions) => {
            console.log('SVG dimensions:', dimensions)
            img.width = dimensions.width
            img.height = dimensions.height
          })
          .catch(reject)
      }
    }
    reader.readAsDataURL(file)
  })
}
