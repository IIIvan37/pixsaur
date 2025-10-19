# 🚀 Quick Start Guide - Pixsaur Implementation

**Version condensée du Implementation Starter Kit**

## 📋 Fichiers de base (toujours fournir)

```bash
cat .github/copilot-instructions.md  # Architecture, patterns, contraintes CPC
cat docs/DOCUMENTATION_INDEX.md      # Navigation vers toute la doc
```

## 🎯 Par type de feature

### Export (ASM, DSK, KIT, etc.)
```bash
# Docs
cat docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md  # Section 2, 5

# Code
cat src/utils/exports/rgb-to-indexes/rgb-to-indexes.ts
cat src/app/store/preview/preview.ts
cat src/palettes/cpc-palette.ts
```

### UI/UX (Resize, Selection, Custom Size)
```bash
# Docs
cat docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md  # Section 6, 8, 9

# Code
cat src/app/store/image/image.ts  # selectionAtom
cat src/components/image-selector/source-selector.tsx
```

### Color/Palette
```bash
# Docs
cat docs/COLORSPACE_SUPPORT.md
cat docs/LOCKED_COLORS_QUANTIZATION_FIX.md

# Code
cat src/palettes/cpc-palette.ts
cat src/app/store/palette/palette.ts
cat src/libs/pixsaur-color/src/space/
```

### Internationalization
```bash
# Docs
cat docs/I18N_GUIDE.md

# Code
cat lingui.config.js
cat src/app/i18n-provider.tsx
cat src/locales/en/messages.po
```

---

**Pour le guide complet** : Voir `docs/IMPLEMENTATION_STARTER_KIT.md`
