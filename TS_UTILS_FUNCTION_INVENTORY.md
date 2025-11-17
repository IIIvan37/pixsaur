# Inventaire — src/utils

Ce fichier liste les fonctions et utilitaires exportés et helpers du dossier `src/utils`.

Objectif: repérer les groupes thématiques, prioriser la factorisation et établir un plan de refactor.

## Organisation par fichier

- `src/utils/validate-custom-dimensions.ts`

  - validateCustomDimensions()

- `src/utils/is-development.ts`

  - isDevelopment()

- `src/utils/is-tauri.ts`

  - isTauri()

- `src/utils/quit-shortcut.ts`

  - isEditableElement(el)
  - isQuitShortcut(event)

- `src/utils/download-file.ts`

  - downloadFile()

- `src/utils/image-resize.ts`

  - applyResize()
  - resizeAuto() (internal)
  - resizeOrigin() (internal)
  - extractSelection()

- `src/utils/image-processing/horizontal-smoothing.ts`

  - applyHorizontalSmoothing()
  - getPixelWidthForMode()

- `src/utils/logger.ts`

  - createLogger()
  - PerformanceLogger (class)
  - sendLogToDebugWindow() (internal)

- `src/utils/amsdos-filename.ts`

  - validateAmsdosFilename()
  - sanitizeAmsdosFilename()
  - generateDskImageFilename()

- `src/utils/get-visual-region.ts`

  - getVisualRegion()
  - getVisualRegionNormalized()

- `src/utils/exports/export-zip.ts`

  - exportZip()
  - exportCPCPlusData(), exportCPCClassicData() (internals)

- `src/utils/exports/export-linear-asm/export-linear.asm.ts`

  - exportLinearAsm()
  - splitLinearIntoChunks()

- `src/utils/exports/export-tauri.ts`

  - saveTauriFile()
  - saveZipFileTauri()

- `src/utils/exports/color-utils.ts`

  - findDarkestColor()

- `src/utils/exports/export-png-utils.ts`

  - createSquarePixelsCanvas()
  - createCorrectedAspectCanvas()
  - canvasToPNGBlob()

- `src/utils/exports/asm-templates.ts`

  - generateASMComment()
  - generateDataSection()
  - generatePaletteSection()

- `src/utils/exports/cpc-plus-format.ts`

  - rgbToCPCPlus()
  - cpcPlusToRGB()
  - rgbToCPCPlusBytes()
  - paletteToCPCPlusData()
  - paletteToCPCPlusValues()
  - cpcPlusValuesToASM()
  - injectCPCPlusPaletteIntoSCR()

- `src/utils/exports/asm-generator.ts`

  - generateSCRAsm()
  - generateLinearAsm()
  - generatePaletteAsm()

- `src/utils/exports/generate-dsk-readme.ts`

  - generateDskReadme()

- `src/utils/exports/templates/scr-loader-template.ts`

  - generateScrLoaderClassic()
  - generateUniversalScrLoader()
  - generateScrLoaderPlus()

- `src/utils/exports/to-asm-data.ts`

  - toASMData()
  - toASMDataSingle() (internal)
  - toASMDataChunkedFiles() (internal)

- `src/utils/exports/exporters/*` (multiple files)

  - Export functions for palette, PNG, SCR, linear, ZIP — many are async and perform file/output assembly and compression.

- `src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts`

  - quantizeCPC() (internal)
  - findDarkestColorIndex() (internal)
  - buildPaletteMap() (internal)
  - quantizePixel() (internal)
  - findPaletteIndex() (internal)
  - rgbToIndexBufferExact() — exported
  - remapImageDataToPalette() — exported

- `src/utils/test-utils.tsx`

  - renderWithI18n()
  - renderWithJotai()
  - renderWithProviders()
  - mockGlobalImage()
  - createTestImageData()
  - createGradientImageData()

- `src/utils/invariant.ts`

  - invariant()

- `src/utils/exports/encode-byte/encode-byte.ts`

  - encodeByte()

- `src/utils/cpc-calculations.ts`
  - getWidthStepForMode()
  - getAspectRatioMultipliers()
  - quantizeCPC()
  - quantifyToCPCPlus()
  - getPixelsPerByte()

## Observations et recommandations

- Volume: `src/utils/exports/*` est un gros sous-dossier focalisant beaucoup de logique liée à la génération d'ASM, ZIP, SCR et PNG — il est logique de garder ces fonctions groupées, mais il faut rationaliser l'API.
- Granularité: `utils` mélange utilitaires très génériques (`isDevelopment`, `invariant`), utilitaires spécifiques à la plateforme (`isTauri`, `saveTauriFile`), et logique métier (`rgbToCPCPlus`, `generateSCRAsm`). C'est source de confusion pour la réutilisation et tests.
- Suggestion: scinder `src/utils` en sous-modules à thème : `utils/platform`, `utils/image`, `utils/exports`, `utils/string`, `utils/testing`, `utils/validation`.

## Plan de refactor pour `src/utils`

1. Créer sous-dossiers thématiques et déplacer les fichiers une fois :

   - `utils/platform/` -> `isTauri.ts`, `download-file.ts`, `saveTauriFile.ts` (platform helpers)
   - `utils/image/` -> `image-resize.ts`, `image-processing/`, `exports/export-png-utils.ts` (image helpers)
   - `utils/exports/` -> déjà présent, ajouter `index.ts` pour exposer public API (exportSCR, exportZip, exportPNG, exportPalettes)
   - `utils/cpc/` -> `cpc-calculations.ts`, `rgb-to-indexes` (CPC-specific logic)
   - `utils/tests/` -> `test-utils.tsx` (testing helpers)
   - `utils/core/` -> `invariant.ts`, `logger.ts`, `validate-custom-dimensions.ts`

2. Introduire index files pour chaque submodule (`index.ts`) — exports public.

3. Introduire de petits tests unitaires supplémentaires pour fonctions critiques (exportZIP, rgbToIndexBufferExact, applyResize) et benchmarks pour `image-resize`.

4. Migration progressive:

   - phase 1: déplacer les fichiers (sans toucher l'API), ajouter `utils/exports/index.ts` et mettre à jour imports dans le projet.
   - phase 2: extraire fonctions communes (ex.: `computeCPCAddress`) dans un module `utils/cpc` et améliorer la couverture de tests.

5. Améliorations API:

   - Harmoniser les noms `exportZip`, `exportSCR` sous un namespace `exports`.
   - Remplacer certains `any`/`unknown` par types (`Palette`, `Vector`, `CanvasLike`) — utilise `libs/pixsaur-color/src/types` si existant ou créé.

6. Nettoyage (deprecations):
   - Lorsque les fonctions changent d'emplacement, créer un wrapper léger à l'ancien chemin qui appelle la nouvelle fonction et ajoute un `console.warn` (déprécation) — garder pendant au moins une release.

## Exemple de priorité

1. `utils/exports` — gros volume & tests. Permet baisse rapide de complexité.
2. `utils/image` (image-resize + image processing) — performance critique.
3. `utils/cpc` — domaine spécifique, isoler les conversions/format.
4. `utils/core` — logger, invariant, validations.

---

Souhaites-tu que je commence la phase 1 (création des sous-dossiers et actualisation des imports) sur la branche `refactoring` ? Si oui, je ferai un petit PR par groupe (exports -> image -> cpc -> core) pour limiter le risque.
