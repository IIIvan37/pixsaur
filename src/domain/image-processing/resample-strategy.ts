// Resize strategy applied to every pixel mode. 'classic' = legacy gamma-space
// canvas downscale; box/tent/lanczos2 = linear-light reconstruction filters.
export type ResampleStrategy = 'classic' | 'box' | 'tent' | 'lanczos2'
