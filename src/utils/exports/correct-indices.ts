/**
 * Corrige les indices de couleur pour correspondre au format Img2CPC
 * Échange les bits 1 et 2 de chaque index
 */
export function correctColorIndicesForCPC(indices: Uint8Array): Uint8Array {
  const corrected = new Uint8Array(indices.length)

  for (let i = 0; i < indices.length; i++) {
    const originalIndex = indices[i]

    // Extraire les bits individuels
    const b0 = (originalIndex >> 0) & 1 // bit 0
    const b1 = (originalIndex >> 1) & 1 // bit 1
    const b2 = (originalIndex >> 2) & 1 // bit 2
    const b3 = (originalIndex >> 3) & 1 // bit 3

    // Reconstruire l'index avec bits 1 et 2 échangés
    const correctedIndex = (b0 << 0) | (b2 << 1) | (b1 << 2) | (b3 << 3)

    corrected[i] = correctedIndex
  }

  return corrected
}
