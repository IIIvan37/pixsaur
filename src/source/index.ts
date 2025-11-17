// Thematic entrypoint for Source-related UI and helpers
export { ImageUpload } from '@/components/image-upload/image-upload'
export { processImageFile } from '@/components/image-upload/utils'
export { pickImageFileTauriAsFile } from '@/tauri'
export type {
  ConfiguredImage,
  ProcessedImage,
  SourceImage
} from '@/types/image'
export * from './image-resize'
// validateCustomDimensions lives in `preview` (this is a preview/output concern)
