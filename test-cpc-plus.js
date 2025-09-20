// Test rapide pour vérifier que le système CPC/CPC Plus fonctionne
import { getCPCPaletteByType } from '../src/palettes/cpc-palette'

console.log('=== Test du système CPC/CPC Plus ===')

// Test palette classique
const classicPalette = getCPCPaletteByType('classic')
console.log(`Palette classique: ${classicPalette.length} couleurs`)
console.log(
  'Premières couleurs classiques:',
  classicPalette.slice(0, 3).map((c) => c.name)
)

// Test palette Plus
const plusPalette = getCPCPaletteByType('plus')
console.log(`Palette Plus: ${plusPalette.length} couleurs`)
console.log(
  'Premières couleurs Plus:',
  plusPalette.slice(0, 3).map((c) => c.name)
)

// Vérification que les palettes sont différentes
console.log(
  'Les palettes sont différentes:',
  classicPalette.length !== plusPalette.length
)
