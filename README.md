# Pixsaur 🦖

**Convertisseur d'images pour Amstrad CPC** - Application web et desktop avec quantification de palette, dithering, et exports multiformats.

> Transformez vos images modernes en graphismes rétro Amstrad CPC avec précision et performance.

Pixsaur est une application moderne de traitement d'images spécialisée dans la conversion vers les formats Amstrad CPC. Architecture adaptateur CPU/GPU avec support complet des contraintes matérielles CPC (palettes 27/4096 couleurs, modes d'écran, dimensions, mémoire).

## ✨ Fonctionnalités

### 🎨 Traitement d'Image
- **Ajustements** : Luminosité, contraste, saturation temps réel
- **Sélection interactive** : Rectangle de sélection visuel avec drag & resize
- **Aperçu CRT** : Effet scanlines authentique

### 🎯 Quantification Palette
- **CPC Classic** : 27 couleurs hardware (RGB [0, 128, 255])
- **CPC Plus** : 4096 couleurs (12-bit RGB)
- **Espaces colorimétriques** : RGB, Lab, XYZ pour précision maximale
- **Locked colors** : Verrouillage de couleurs spécifiques
- **Distance metrics** : Euclidean, Delta-E pour sélection optimale

### 💾 Exports Multiformats
- **SCR** : Format binaire AMSDOS standard
- **ASM** : Code assembleur Z80 avec labels configurables *(roadmap)*
- **DSK** : Images disque Amstrad *(roadmap)*
- **KIT** : Palettes CPC Plus 12-bit *(roadmap)*
- **Plus de formats** : CMP, IMP, Tiles *(roadmap)*

### 🚀 Performance
- **Architecture adaptateur** : CPU stable, GPU en développement
- **Processing intelligent** : Cache et réutilisation des processeurs
- **Benchmarks** : ~1.2s pipeline complet (766×800px)

## 🚀 Démarrage Rapide

```bash
# Installation
pnpm install

# Développement web (http://localhost:5173)
pnpm dev

# Desktop (Tauri)
pnpm tauri:dev

# Build production
pnpm build

# Tests
pnpm test

# Type checking
pnpm typecheck
```

## 🎯 Fonctionnalités

- **Traitement d'images** : Ajustements de luminosité, contraste, saturation
- **Quantification de palette** : Conversion vers palettes couleur spécifiques
- **Architecture adaptateur** : Support CPU/GPU avec fallback intelligent
- **Performance optimisée** : Monitoring et benchmarks intégrés

## 🔧 Stack Technique

### Frontend
- **React 19** - Framework UI moderne
- **TypeScript** - Type safety strict
- **Vite** - Build ultra-rapide avec HMR
- **Jotai** - State management atomic
- **Radix UI** - Composants accessibles

### Traitement d'Image
- **Canvas API** - Manipulation pixels
- **pixsaur-color** - Bibliothèque colorimétrique custom (Lab, XYZ, RGB)
- **CPU Quantizer** - Algorithmes de quantification stable
- **ReGL Quantizer** - Accélération GPU (en développement)

### Développement
- **Vitest** - Tests unitaires avec happy-dom
- **Biome** - Linting et formatting unifié
- **Lingui** - Internationalisation (en, fr, de, es)
- **pnpm** - Package manager performant

## �️ Architecture

### Pattern Adaptateur

### Pattern Adaptateur

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Jotai Atoms, React Components)        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│       Adapter Factory + Cache           │
│  createCPUQuantizer() / createReGL...   │
└────────┬────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────────┐
│  CPU   │ │ ReGL (GPU+CPU)   │
│ Stable │ │ En développement │
└────────┘ └──────────────────┘
```

**Avantages** :
- ✅ Interface unifiée pour tous les processors
- ✅ Fallback automatique GPU → CPU
- ✅ Cache et réutilisation des instances
- ✅ Extensible pour futurs processors

### State Management (Jotai)

```typescript
// Architecture atomique
workingImageAtom          // Image source
  ↓
selectionAtom             // Rectangle de sélection
  ↓
quantizerAtom             // Quantizer configuré
  ↓
reducedPaletteRawAtom     // Palette working colorspace
  ↓
reducedPaletteRgbAtom     // Palette RGB quantifiée CPC
  ↓
previewImageAtom          // Image finale avec dithering
```

**Pattern** : Computed atoms pour transformations, pas de prop drilling

### Contraintes CPC

```typescript
// RGB values MUST be [0, 128, 255] only
const quantizeCPC = (value: number) => 
  value < 64 ? 0 : value < 192 ? 128 : 255

// Dimensions constraints
width % 8 === 0        // CPC pixel encoding
height % 2 === 0       // Screen interlacing
memory <= 65536        // 64Ko max (varies by mode)
```

## 📊 Performance

### Benchmarks Actuels (CPU)
| Pipeline | Temps | Image |
|----------|-------|-------|
| Ajustements | ~37ms | 766×800px |
| Quantification | ~408-431ms | 16 colors |
| Total | ~1263ms | Full pipeline |

### Objectifs GPU (ReGL)
| Niveau | Performance | Status |
|--------|-------------|--------|
| Minimum | 2× CPU | 🚧 En cours |
| Recommandé | 4× CPU | 🎯 Objectif |
| Excellent | 6× CPU | 🌟 Bonus |

**Note** : GPU Limited à RGB, fallback CPU automatique pour Lab/XYZ

## 🗺️ Roadmap

### ✅ Implémenté
- [x] Quantification CPC Classic (27 colors) et Plus (4096 colors)
- [x] Sélection interactive avec rectangle visuel
- [x] Export SCR avec palette injection
- [x] Espaces colorimétriques multiples (RGB, Lab, XYZ)
- [x] Locked colors et contrast optimization
- [x] Internationalisation (4 langues)
- [x] Architecture adaptateur CPU/GPU
- [x] CRT effect avec scanlines

### 🚧 En Développement
- [ ] ReGL Quantizer (accélération GPU)
- [ ] Optimisations performance CPU

### 📋 Planifié (Phases)

**Phase 1 - Exports Essentiels**
- [ ] Export ASM avec code assembleur configurable
- [ ] Export DSK (images disque Amstrad)
- [ ] Dialog SaveMedia avec presets

**Phase 2 - UI/UX Avancée**
- [ ] 5 modes de redimensionnement (Fit, KeepSmaller, KeepLarger, UserSize, Origin)
- [ ] Taille destination personnalisée avec validation 64Ko
- [ ] Presets CPC (Standard, Overscan, modes 0/1/2)
- [ ] Boutons ×2/÷2 pour dimensions

**Phase 3 - Exports Avancés**
- [ ] Format CMP avec compression (ZX0, ZX1, Standard)
- [ ] Format KIT (palettes CPC Plus 12-bit)
- [ ] Format IMP (split-screen)
- [ ] Format Tiles avec déduplication

**Phase 4 - Fonctionnalités Avancées**
- [ ] Dithering personnalisé (patterns, intensité)
- [ ] Distance RGB pondérée
- [ ] Lissage horizontal anti-aliasing
- [ ] Gestion animations et sprites

**Phase 5 - Optimisations**
- [ ] GPU complete (Lab/XYZ colorspaces)
- [ ] Batch processing multiple images
- [ ] Web Workers pour threading
- [ ] Cache amélioré

## 🤝 Contribution

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Start
1. Fork the project
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow code standards (TypeScript strict, Biome linting)
4. Test your changes: `pnpm test && pnpm typecheck`
5. Commit with clear messages
6. Push and create a Pull Request

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details

---

**Made with ❤️ for the Amstrad CPC community**
