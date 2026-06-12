// ImagePreview.tsx

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import {
  effectiveModeConfigAtom,
  smoothingAtom
} from '@/app/store/config/config'
import {
  previewCanvasSizeAtom,
  previewCanvasWidthAtom
} from '@/app/store/preview/preview'
import { effectivePreviewImageAtom } from '@/app/store/raster/raster'
import { ManualEditsWarning } from '@/components/manual-edits-warning'
import { PreviewEditor } from '@/components/preview-editor'
import { createCorrectedAspectCanvas } from '@/export'
import { isTauri } from '@/tauri'
import { ImagePreviewView } from './image-preview-view'
import { useObservedCanvasWidth } from './use-observed-canvas-width'

// Mémoriser le résultat de isTauri pour éviter les logs répétés
const IS_TAURI = isTauri()

const ImagePreview = () => {
  const { _ } = useLingui()
  const ref = useRef<HTMLCanvasElement>(null)
  const smoothing = useAtomValue(smoothingAtom)
  const previewImage = useAtomValue(effectivePreviewImageAtom)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)

  const setWidth = useSetAtom(previewCanvasWidthAtom)
  const { width, height } = useAtomValue(previewCanvasSizeAtom)

  const containerRef = useObservedCanvasWidth((proposedWidth) => {
    setWidth(proposedWidth)
  }, 320)

  const draw = useCallback(() => {
    const canvas = ref.current
    if (!canvas || !previewImage || width <= 0 || height <= 0) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = smoothing

    // previewImage est maintenant un ImageData, pas un Canvas
    if (previewImage instanceof ImageData) {
      // Créer un canvas temporaire pour l'ImageData
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = previewImage.width
      tempCanvas.height = previewImage.height
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.putImageData(previewImage, 0, 0)

        // Dessiner le canvas temporaire sur le canvas de destination
        ctx.drawImage(
          tempCanvas,
          0,
          0,
          tempCanvas.width,
          tempCanvas.height,
          0,
          0,
          width,
          height
        )
      }
    }
  }, [previewImage, width, height, smoothing])

  // Repaint whenever the drawing inputs change. `draw` is memoized on the same
  // deps, so this fires exactly once per relevant change (no double paint).
  useEffect(() => {
    draw()
  }, [draw])

  const handleCanvasClick = useCallback(async () => {
    if (!previewImage) return

    // In Tauri, don't open in new tab - it would open in system browser
    if (IS_TAURI) {
      return
    }

    // Create a canvas with the actual image dimensions (not display dimensions)
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = previewImage.width
    sourceCanvas.height = previewImage.height
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return
    sourceCtx.putImageData(previewImage, 0, 0)

    // Create corrected aspect ratio canvas using shared utility
    const correctedCanvas = createCorrectedAspectCanvas(
      sourceCanvas,
      modeConfig
    )

    // Convert to blob and create blob URL for better compatibility
    correctedCanvas.toBlob((blob: Blob | null) => {
      if (blob) {
        const blobUrl = URL.createObjectURL(blob)

        // Wrap the image in a minimal HTML document. Serving it as its own
        // blob URL (instead of injecting innerHTML into an opened window) keeps
        // the new tab navigated to a real document and avoids string-built DOM.
        // Blob URLs are more reliable than data URLs for opening in new tabs.
        const html = `<!DOCTYPE html>
<html>
<head>
  <title>Preview - Pixsaur</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
    img { max-width: 100%; max-height: 100vh; image-rendering: pixelated; cursor: pointer; }
  </style>
</head>
<body>
  <img src="${blobUrl}" alt="CPC Preview" onload="URL.revokeObjectURL('${blobUrl}')" />
</body>
</html>`

        const htmlUrl = URL.createObjectURL(
          new Blob([html], { type: 'text/html' })
        )
        window.open(htmlUrl, '_blank')
      }
    }, 'image/png')
  }, [previewImage, modeConfig])

  const tooltip = _(msg`Cliquer pour ouvrir dans un nouvel onglet`)

  return (
    <>
      <ManualEditsWarning />
      <ImagePreviewView
        containerRefCallback={containerRef}
        ref={ref}
        image={previewImage}
        width={width}
        height={height}
        onClick={IS_TAURI ? undefined : handleCanvasClick}
        tooltip={IS_TAURI ? undefined : tooltip}
      />
      {/* Editor modal - renders when editorMode is true */}
      <PreviewEditor />
    </>
  )
}

ImagePreview.displayName = 'ImagePreview'
export default ImagePreview
