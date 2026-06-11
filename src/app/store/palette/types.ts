// Re-export the canonical palette-slot type from the domain layer so the store
// and domain share a single definition (no duplicate shape to drift).
export type { PaletteSlot } from '@/domain/cpc'
