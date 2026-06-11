import type { CanvasFactory } from '../ports'

/**
 * DOM adapter for {@link CanvasFactory}: creates a detached `<canvas>`. Serves
 * both web and desktop (the Tauri app renders in a webview).
 */
export const domCanvasFactory: CanvasFactory = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
}
