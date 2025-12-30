import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { RasterChange } from '@/libs/pixsaur-raster/types'
import type { CPCHardware } from '@/libs/types'

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
  cpcHardware: CPCHardware // Hardware type for palette format
  paletteFirmware: number[] // Firmware palette indices for CPC Classic export
  palettePlus?: number[] // CPC Plus 16-bit palette values (optional, only for CPC Plus)
  thumbnailDataUrl?: string // Base64 data URL for preview
  paletteColors?: string[] // RGB hex colors for palette display
  rasterChanges?: RasterChange[] // Raster changes for this image (optional)
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
      cpcHardware: CPCHardware
      paletteFirmware: number[]
      palettePlus?: number[]
      thumbnailDataUrl?: string
      paletteColors?: string[]
      rasterChanges?: RasterChange[]
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
      ] as DskImage[]
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
