# Pixsaur - AI Development Guide

**Pixsaur** is a React/TypeScript image converter for Amstrad CPC computers, specializing in color quantization, dithering, and palette management with strict CPC hardware constraints.

## Core Architecture

### State Management (Jotai)
- **Atomic state pattern**: All state uses Jotai atoms in `/src/app/store/`
- **Key atoms**: `workingImageAtom`, `reducedPaletteRgbAtom`, `previewImageAtom`, `configAtom`
- **Derived atoms**: Use computed atoms for data transformations (e.g., `quantizerAtom` → `reducedPaletteRawAtom` → `reducedPaletteRgbAtom`)
- **Babel preset**: Jotai babel preset enabled in `vite.config.ts` for debugging

### Color Science Foundation
**Critical**: All CPC colors use **only** RGB values `[0, 128, 255]` - the hardware limitation that drives the entire app.

- **Quantization function**: `quantizeCPC()` in `/src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts` enforces this constraint
- **Color spaces**: Support Lab, XYZ, RGB via `/src/libs/pixsaur-color/src/space/`
- **Distance metrics**: Euclidean, Delta-E variants for palette selection

### Component Architecture
- **Feature-based structure**: `/src/components/{feature}/{feature}.tsx` with co-located `.spec.tsx`, `.module.css`
- **UI components**: Radix UI + custom CSS modules in `/src/components/ui/`
- **View/Logic separation**: `-view.tsx` for presentation, main component for logic
- **Props pattern**: Avoid prop drilling - use Jotai atoms directly in components

## CPC-Specific Patterns

### Palette Management
```typescript
// Always use the full 27-color CPC palette as base
const basePalette = generateAmstradCPCPalette() // [0,128,255] RGB values only

// Quantization pipeline: Working colorspace → RGB → CPC quantization
const quantified = projected.map(([r, g, b]) => {
  return [quantizeCPC(r), quantizeCPC(g), quantizeCPC(b)] as Vector<'RGB'>
})
```

### Image Processing Pipeline
1. **Input**: `workingImageAtom` (canvas-based)
2. **Selection**: `selectionAtom` for crop regions  
3. **Quantization**: `quantizerAtom` using `createQuantizer()` with CPC base palette
4. **Color reduction**: `reducedPaletteRawAtom` (working colorspace) → `reducedPaletteRgbAtom` (quantized RGB)
5. **Preview**: `previewImageAtom` with dithering applied

### Export System
- **Critical**: `rgbToIndexBufferExact()` expects exact RGB matches in CPC palette
- **Error prevention**: Use `reducedPaletteRgbAtom` (quantized) for exports, never raw working colorspace values
- **File formats**: SCR (CPC screen format) with palette injection via `injectPaletteDataIntoSCR()`

## Development Workflow

### Commands
```bash
pnpm dev          # Vite dev server
pnpm test         # Vitest in watch mode  
pnpm build        # TypeScript + Vite build
pnpm typecheck    # TypeScript validation only
```

### Testing Strategy
- **Vitest**: `globals: true`, `happy-dom` environment
- **Test location**: Co-located `.spec.tsx` files
- **Critical tests**: Color quantization logic, export pipeline integrity
- **Example**: `/src/app/store/preview/export-integration.spec.ts` validates CPC quantization

### Build Configuration
- **Path aliases**: `@/` → `src/`
- **Babel**: Jotai preset for atom debugging
- **TypeScript**: Strict mode enabled

## Common Patterns

### Error Handling
```typescript
// Export errors typically indicate quantization issues
expect(() => rgbToIndexBufferExact(imageData, reducedPalette)).not.toThrow()
```

### Component Props Pattern
```typescript
// Prefer atoms over prop drilling
const ColorSlot = () => {
  const palette = useAtomValue(reducedPaletteRgbAtom) // Not via props
  // ...
}
```

### CSS Modules
- **File naming**: `{component}.module.css`
- **Usage**: `styles.className` imports
- **Global styles**: `/src/styles/global.css`

## Critical Files
- `/src/app/store/preview/preview.ts` - Core image processing pipeline
- `/src/palettes/cpc-palette.ts` - CPC color definitions and utilities  
- `/src/libs/pixsaur-color/` - Color science library (custom)
- `/src/utils/exports/rgb-to-indexes/` - Export validation and conversion
- `/src/app/store/config/config.ts` - Global app configuration atoms

## Debugging Tips
- **Quantization errors**: Check `reducedPaletteRgbAtom` values are `[0,128,255]` only
- **Export failures**: Verify image uses exact CPC palette colors via `rgbToIndexBufferExact()`
- **Atom state**: Use Jotai devtools via babel preset
- **Color distances**: Use appropriate distance metrics for color space

When working on this codebase, always consider the CPC hardware constraints and maintain the quantization pipeline integrity.