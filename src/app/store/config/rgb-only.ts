/**
 * Configuration RGB seulement - remplacement du colorSpaceAtom
 * 
 * Après simplification de l'architecture, Pixsaur ne supporte plus que RGB.
 * Ce fichier fournit un atom RGB constant pour maintenir la compatibilité
 * avec le code existant pendant la transition.
 */

import { atom } from 'jotai'

// Atom RGB constant - remplace l'ancien colorSpaceAtom
export const rgbColorSpaceAtom = atom('RGB' as const)

// Setter no-op pour compatibilité - les changements d'espace couleur sont ignorés
export const setRgbColorSpaceAtom = atom(null, () => {
  // No-op: L'espace couleur est fixé sur RGB
  console.warn('Color space is now fixed to RGB - ignoring color space change')
})

// Type pour remplacer ColorSpace
export type RGBColorSpace = 'RGB'