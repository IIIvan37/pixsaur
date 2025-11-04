import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export interface DskImage {
  id: string
  name: string
  scrData: number[] // Array instead of Uint8Array for JSON serialization
  mode: 0 | 1 | 2
  width: number
  height: number
  overscan: boolean
  nColors: number
  scaleX: number
  scaleY: number
  paletteFirmware: number[] // Firmware palette indices for export
}

interface DskWorkspaceData {
  images: DskImage[]
}

// Atom with localStorage persistence
const dskWorkspaceStorageAtom = atomWithStorage<DskWorkspaceData>(
  'pixsaur-dsk-workspace',
  {
    images: []
  }
)

// Read-only atom to get images list
export const dskImagesAtom = atom((get) => get(dskWorkspaceStorageAtom).images)

// Read-only atom to check if workspace has images
export const hasDskImagesAtom = atom(
  (get) => get(dskWorkspaceStorageAtom).images.length > 0
)

// Write-only atom to add an image to the workspace
export const addImageToDskAtom = atom(
  null,
  (
    get,
    set,
    image: {
      name: string
      scrData: Uint8Array
      mode: 0 | 1 | 2
      width: number
      height: number
      overscan: boolean
      nColors: number
      scaleX: number
      scaleY: number
      paletteFirmware: number[]
    }
  ) => {
    const workspace = get(dskWorkspaceStorageAtom)
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    set(dskWorkspaceStorageAtom, {
      images: [
        ...workspace.images,
        {
          ...image,
          id,
          scrData: Array.from(image.scrData) // Convert Uint8Array to array for storage
        }
      ]
    })
  }
)

// Write-only atom to remove an image from the workspace
export const removeImageFromDskAtom = atom(
  null,
  (get, set, imageId: string) => {
    const workspace = get(dskWorkspaceStorageAtom)
    set(dskWorkspaceStorageAtom, {
      images: workspace.images.filter((img) => img.id !== imageId)
    })
  }
)

// Write-only atom to clear the workspace
export const clearDskWorkspaceAtom = atom(null, (_get, set) => {
  set(dskWorkspaceStorageAtom, { images: [] })
})
