# 🚀 Implementation Starter Kit - Pixsaur

**Date**: October 19, 2025  
**Purpose**: Liste des fichiers essentiels à fournir au début d'une nouvelle session d'implémentation

---

## 📁 Catégorie 1 : Documentation Stratégique (TOUJOURS fournir)

### 1.1 Instructions AI Copilot
```
.github/copilot-instructions.md
```
- **Pourquoi** : Contient l'architecture Pixsaur, patterns Jotai, contraintes CPC
- **Contenu clé** : State management, color quantization, export pipeline
- **Usage** : Guide l'AI sur les patterns du projet

### 1.2 Documentation Index
```
docs/DOCUMENTATION_INDEX.md
```
- **Pourquoi** : Point d'entrée central pour toute la documentation
- **Contenu clé** : Structure des docs, récents changements, liens rapides
- **Usage** : Naviguer rapidement vers la bonne documentation

### 1.3 Guide de Développement
```
docs/DEVELOPMENT_GUIDE.md
```
- **Pourquoi** : Patterns de code, conventions, workflows
- **Contenu clé** : Architecture, testing, common patterns
- **Usage** : Standards de code et bonnes pratiques

---

## 📁 Catégorie 2 : Analyse Fonctionnelle (selon la feature)

### 2.1 Export Features (ASM, DSK, KIT, etc.)
```
docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md
docs/analysis/CONVIMGCPC_ANALYSIS.md
```
- **Contenu** : 17+ formats d'export, compression, roadmap
- **Sections clés** : 
  - Section 2 : Export System (formats SCR, ASM, CMP, DSK, KIT)
  - Section 5 : Implementation Plan (5 phases, 16-20 semaines)
  - Section 8 : Dimensioning System (5 resize modes)

### 2.2 UI/UX Features (Resize, Selection, Custom Size)
```
docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md (Section 6, 8, 9)
```
- **Contenu** : Modes de redimensionnement, validation 64Ko, presets CPC
- **Code fourni** : TypeScript pour validateTargetSize(), calculateMemoryUsage()

### 2.3 Color Science Features (Palettes, Quantization)
```
docs/COLORSPACE_SUPPORT.md
docs/LOCKED_COLORS_QUANTIZATION_FIX.md
docs/CPC_PLUS_CONTRAST_FIX.md
```
- **Contenu** : Espaces colorimétriques, quantization CPC, locked colors

### 2.4 Internationalization
```
docs/I18N_GUIDE.md
docs/I18N_IMPLEMENTATION_SUMMARY.md
```
- **Contenu** : Lingui setup, patterns de traduction, workflow

---

## 📁 Catégorie 3 : Code Source Existant (selon la feature)

### 3.1 Store (Atoms Jotai)
```
src/app/store/config/config.ts          # Configuration globale
src/app/store/image/image.ts            # Selection, downscaling
src/app/store/palette/palette.ts        # Palette management
src/app/store/preview/preview.ts        # Preview pipeline
```
- **Pourquoi** : Architecture state management centralisée
- **Pattern** : Atomic state, derived atoms, computed values

### 3.2 Export System
```
src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts  # Quantization
src/utils/exports/scr-export.ts                      # SCR format
src/utils/exports/inject-palette-data.ts             # Palette injection
```
- **Pourquoi** : Pipeline d'export existant à étendre
- **Pattern** : rgbToIndexBufferExact() pour validation CPC

### 3.3 Color Science
```
src/palettes/cpc-palette.ts            # CPC palette [0,128,255]
src/libs/pixsaur-color/src/space/      # Lab, XYZ, RGB conversions
```
- **Pourquoi** : Quantization CPC, distance metrics
- **Pattern** : quantizeCPC() enforce hardware constraints

### 3.4 UI Components
```
src/components/image-selector/source-selector.tsx   # Rectangle selection
src/components/export-panel/                        # Export UI
src/components/ui/                                   # Radix UI components
```
- **Pourquoi** : UI existante à étendre ou imiter
- **Pattern** : Feature-based structure, CSS modules co-localisés

---

## 📁 Catégorie 4 : Configuration Projet

### 4.1 Build & TypeScript
```
package.json                 # Dependencies, scripts
tsconfig.json               # TypeScript config strict
vite.config.ts              # Vite + Jotai babel preset
```

### 4.2 Testing
```
vitest.config.ts            # Vitest setup
vitest.setup.tsx            # Test globals
src/utils/test-utils.tsx    # Test helpers
```

### 4.3 Internationalization
```
lingui.config.js            # Lingui configuration
src/locales/                # Translations (en, fr, de, es)
```

---

## 🎯 Checklists par Type de Feature

### ✅ Feature Export (ASM, DSK, KIT, etc.)

**Documents obligatoires** :
- [ ] `.github/copilot-instructions.md`
- [ ] `docs/DOCUMENTATION_INDEX.md`
- [ ] `docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md` (Section 2, 5)

**Code source obligatoire** :
- [ ] `src/utils/exports/` (tous les fichiers existants)
- [ ] `src/app/store/preview/preview.ts` (preview pipeline)
- [ ] `src/palettes/cpc-palette.ts` (CPC constraints)

**Code source optionnel (si UI nécessaire)** :
- [ ] `src/components/export-panel/`
- [ ] `src/components/ui/` (dialog, button, etc.)

---

### ✅ Feature UI/UX (Resize, Custom Size, etc.)

**Documents obligatoires** :
- [ ] `.github/copilot-instructions.md`
- [ ] `docs/DOCUMENTATION_INDEX.md`
- [ ] `docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md` (Section 6, 8, 9)

**Code source obligatoire** :
- [ ] `src/app/store/image/image.ts` (selectionAtom)
- [ ] `src/app/store/config/config.ts` (config atoms)
- [ ] `src/components/image-selector/source-selector.tsx` (selection UI)

**Code source optionnel** :
- [ ] `src/utils/get-visual-region.ts` (region calculations)
- [ ] `src/components/ui/` (form controls)

---

### ✅ Feature Color/Palette

**Documents obligatoires** :
- [ ] `.github/copilot-instructions.md`
- [ ] `docs/DOCUMENTATION_INDEX.md`
- [ ] `docs/COLORSPACE_SUPPORT.md`
- [ ] `docs/LOCKED_COLORS_QUANTIZATION_FIX.md`

**Code source obligatoire** :
- [ ] `src/palettes/cpc-palette.ts`
- [ ] `src/app/store/palette/palette.ts`
- [ ] `src/libs/pixsaur-color/src/` (color science lib)
- [ ] `src/utils/exports/rgb-to-indexes/` (quantization)

---

### ✅ Feature Internationalization

**Documents obligatoires** :
- [ ] `.github/copilot-instructions.md`
- [ ] `docs/I18N_GUIDE.md`
- [ ] `docs/I18N_IMPLEMENTATION_SUMMARY.md`

**Code source obligatoire** :
- [ ] `lingui.config.js`
- [ ] `src/app/i18n-provider.tsx`
- [ ] `src/locales/en/messages.po` (fichier de référence)

**Configuration obligatoire** :
- [ ] `package.json` (scripts extract/compile)

---

## 🚀 Quick Start Commands

### Lire la documentation complète
```bash
# Point d'entrée principal
cat docs/DOCUMENTATION_INDEX.md

# Guide de développement
cat docs/DEVELOPMENT_GUIDE.md
cat .github/copilot-instructions.md
```

### Analyse ConvImgCpc (pour features export/UI)
```bash
cat docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md
```

### Explorer le store (architecture state)
```bash
ls -la src/app/store/
cat src/app/store/config/config.ts
cat src/app/store/image/image.ts
```

### Explorer les exports existants
```bash
ls -la src/utils/exports/
cat src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts
```

---

## 💡 Conseils pour l'AI

### 1. **Toujours commencer par** :
```
1. Lire .github/copilot-instructions.md (architecture globale)
2. Lire docs/DOCUMENTATION_INDEX.md (navigation docs)
3. Identifier la catégorie de feature (Export/UI/Color/I18N)
4. Lire la documentation spécifique de la feature
5. Explorer le code source existant pertinent
```

### 2. **Patterns critiques à respecter** :
- **State** : Jotai atoms uniquement (pas de prop drilling)
- **Colors** : CPC RGB [0, 128, 255] uniquement
- **Export** : Toujours valider via `rgbToIndexBufferExact()`
- **UI** : CSS modules co-localisés, Radix UI components
- **Tests** : Co-localisés `.spec.tsx`, Vitest + happy-dom

### 3. **Erreurs communes à éviter** :
- ❌ Utiliser des valeurs RGB non-quantifiées pour l'export
- ❌ Modifier des fichiers sans lire le contexte existant
- ❌ Ignorer les contraintes CPC (width %8, height pair, 64Ko max)
- ❌ Ajouter du prop drilling au lieu d'utiliser des atoms
- ❌ Créer des composants sans CSS modules

---

## 📊 Matrice de Décision Rapide

| Feature Type | Docs Requis | Store Requis | Components Requis | Utils Requis |
|--------------|-------------|--------------|-------------------|--------------|
| **Export ASM/DSK** | UI_EXPORT_ANALYSIS Section 2,5 | preview.ts | export-panel/ | exports/ (all) |
| **Resize Modes** | UI_EXPORT_ANALYSIS Section 8,9 | image.ts, config.ts | source-selector/ | get-visual-region.ts |
| **Custom Size 64Ko** | UI_EXPORT_ANALYSIS Section 9 | config.ts, image.ts | image-selector/ | exports/rgb-to-indexes/ |
| **Palette Locked** | LOCKED_COLORS_FIX | palette.ts | color-palette/ | cpc-palette.ts |
| **I18N Translation** | I18N_GUIDE | locale/ | All components | - |
| **Color Quantization** | COLORSPACE_SUPPORT | palette.ts, preview.ts | - | pixsaur-color/ |

---

## 🎯 Exemple : Démarrer Feature "Export ASM"

### Étape 1 : Fournir les documents
```bash
# Documents stratégiques
cat .github/copilot-instructions.md
cat docs/DOCUMENTATION_INDEX.md

# Documentation feature spécifique
cat docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md
# → Lire Section 2 (Export System - ASM format)
# → Lire Section 5 (Implementation Plan - Sprint 1)
```

### Étape 2 : Fournir le code source existant
```bash
# Store
cat src/app/store/preview/preview.ts
cat src/app/store/config/config.ts

# Export system
cat src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts
cat src/utils/exports/scr-export.ts

# UI existante
cat src/components/export-panel/export-panel.tsx

# Palette CPC
cat src/palettes/cpc-palette.ts
```

### Étape 3 : Contexte spécifique (optionnel)
```bash
# Si besoin de comprendre la compression
grep -r "compress\|zx0\|zx1" src/ docs/

# Si besoin de comprendre les labels ASM
cat docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md | grep -A 50 "labels configurables"
```

---

## 📝 Template de Prompt pour Nouvelle Session

```markdown
# 🚀 Nouvelle Session : Implémentation Feature [NOM_FEATURE]

## Context
Je veux implémenter la feature **[NOM_FEATURE]** dans Pixsaur.

## Documents fournis
1. `.github/copilot-instructions.md` (architecture globale)
2. `docs/DOCUMENTATION_INDEX.md` (navigation)
3. `docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md` (Section X, Y)
4. [Autres documents spécifiques...]

## Code source fourni
1. `src/app/store/[store-files].ts` (state management)
2. `src/utils/exports/[export-files].ts` (export pipeline)
3. `src/components/[component-files].tsx` (UI existante)
4. [Autres fichiers pertinents...]

## Objectif
[Description claire de la feature à implémenter]

## Contraintes
- Respecter l'architecture Jotai (atoms uniquement)
- Valider les contraintes CPC (RGB [0,128,255], width %8, height pair)
- Suivre les patterns existants (CSS modules, co-located tests)

## Questions initiales
1. [Question sur l'architecture si besoin]
2. [Question sur les contraintes si besoin]
```

---

## 🔗 Ressources Complémentaires

### Documentation Externe
- **Jotai**: https://jotai.org/docs/introduction
- **Radix UI**: https://www.radix-ui.com/primitives/docs/overview/introduction
- **Vitest**: https://vitest.dev/guide/
- **Lingui**: https://lingui.dev/tutorials/react

### Documentation Interne Avancée
```
docs/architecture/ADAPTER_ARCHITECTURE.md    # Adapter pattern
docs/architecture/REGL_IMPLEMENTATION_GUIDE.md # REGL quantizer
docs/guides/LOGGING_SYSTEM.md                # Logging patterns
docs/CPC_PIXEL_ENCODING.md                   # CPC encoding details
```

---

## ✅ Validation Checklist

Avant de démarrer l'implémentation, vérifier que l'AI a :
- [ ] Lu `.github/copilot-instructions.md`
- [ ] Lu la documentation spécifique de la feature
- [ ] Exploré le code source existant pertinent
- [ ] Compris les patterns Jotai (atoms, derived atoms)
- [ ] Compris les contraintes CPC (RGB quantization, dimensions, 64Ko)
- [ ] Identifié les fichiers à modifier/créer
- [ ] Planifié les étapes d'implémentation

---

**Dernière mise à jour** : 19 octobre 2025  
**Mainteneur** : Documentation Pixsaur  
**Version** : 1.0
