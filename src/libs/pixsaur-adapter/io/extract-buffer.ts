import { Vector } from '@/libs/pixsaur-color/src/type'

/**
 * Transforms an ImageData object into a cloned Uint8ClampedArray buffer.
 *
 * @param imageData  ImageData from canvas.getImageData(...)
 * @returns          Cloned Uint8ClampedArray of imageData.data
 */
export function extractBuffer(imageData: ImageData): Uint8ClampedArray {
  // On clone les données pour ne pas muter l’original
  return new Uint8ClampedArray(imageData.data)
}

/**
 * Converts an ImageData object into an array of RGB vectors.
 *
 * @param imageData  ImageData from canvas.getImageData(...)
 * @returns          Array of RGB vectors
 */
export function imageDataToVectors(imageData: ImageData): Vector<'RGB'>[] {
  const vectors: Vector<'RGB'>[] = []
  const data = extractBuffer(imageData)
  for (let i = 0; i < data.length; i += 4) {
    vectors.push([data[i], data[i + 1], data[i + 2]])
  }
  return vectors
}
