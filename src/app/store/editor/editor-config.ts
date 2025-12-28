import { atom } from 'jotai'

// ============================================================================
// Configuration de l'éditeur de preview
// ============================================================================

/**
 * Mode édition actif ou non
 */
export const editorModeAtom = atom<boolean>(false)

/**
 * Niveau de zoom (1, 2, 4, 8, 16)
 */
export type ZoomLevel = 1 | 2 | 4 | 8 | 16
export const editorZoomAtom = atom<ZoomLevel>(4)

/**
 * Position du viewport (pan) - coin supérieur gauche visible
 */
export const editorViewportAtom = atom<{ x: number; y: number }>({ x: 0, y: 0 })

/**
 * Affichage de la grille de pixels
 */
export const editorGridVisibleAtom = atom<boolean>(true)

/**
 * Encre/couleur sélectionnée (index dans la palette)
 */
export const editorSelectedInkAtom = atom<number>(0)

/**
 * Position du curseur clavier dans la grille
 * null = pas de curseur actif (mode souris)
 */
export const editorCursorAtom = atom<{ x: number; y: number } | null>(null)

/**
 * Position du pixel sous le pointeur souris (pour info)
 */
export const editorHoveredPixelAtom = atom<{ x: number; y: number } | null>(
  null
)
