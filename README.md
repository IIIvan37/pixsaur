# Pixsaur 🦖

**Convertisseur d'images pour Amstrad CPC** - Application web moderne avec quantification de palette, dithering, et exports multiformats.

> Transformez vos images modernes en graphismes rétro Amstrad CPC avec précision et performance.

Pixsaur est une application web moderne de traitement d'images spécialisée dans la conversion vers les formats Amstrad CPC. Architecture adaptateur CPU/GPU avec support complet des contraintes matérielles CPC (palettes 27/4096 couleurs, modes d'écran, dimensions, mémoire).

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

# Desktop (Tauri) - Installe d'abord les dépendances :
./scripts/install-tauri-deps.sh
pnpm tauri:dev

# Build production
pnpm build

# Tests
pnpm test

# Type checking
pnpm typecheck
```

## 📚 Documentation Complète

### 🎯 Pour Démarrer une Implémentation

**Nouveau dans le projet ?** Consultez ces guides dans l'ordre :

```bash
# 1. Point d'entrée : vue d'ensemble
cat docs/DOCUMENTATION_INDEX.md

# 2. Guide rapide : commandes par feature
cat docs/QUICK_START_GUIDE.md

# 3. Instructions AI : architecture et patterns
cat .github/copilot-instructions.md
```

### 📖 Documentation Principale

| Document | Description |
|----------|-------------|
| **[DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md)** | 🗂️ Navigation centrale, récents changements |
| **[QUICK_START_GUIDE.md](./docs/QUICK_START_GUIDE.md)** | ⚡ Commandes bash par type de feature |
| **[IMPLEMENTATION_STARTER_KIT.md](./docs/IMPLEMENTATION_STARTER_KIT.md)** | 📋 Guide complet : checklists, templates, matrice de décision |
| **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** | 🏗️ Architecture, patterns, best practices |

### 🔍 Documentation Spécialisée

**Analyse Compétitive**
- [CONVIMGCPC_ANALYSIS.md](./docs/analysis/CONVIMGCPC_ANALYSIS.md) - Algorithmes et opportunités
- [CONVIMGCPC_UI_EXPORT_ANALYSIS.md](./docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md) - UI et 17+ formats d'export

**Architecture & Implémentation**
- [ADAPTER_ARCHITECTURE.md](./docs/architecture/ADAPTER_ARCHITECTURE.md) - CPU/GPU adapters
- [COLORSPACE_SUPPORT.md](./docs/COLORSPACE_SUPPORT.md) - Espaces colorimétriques
- [I18N_GUIDE.md](./docs/I18N_GUIDE.md) - Internationalisation (Lingui)

**Guides Techniques**
- [LOGGING_SYSTEM.md](./docs/guides/LOGGING_SYSTEM.md) - Patterns de logging
- [CPC_PIXEL_ENCODING.md](./docs/CPC_PIXEL_ENCODING.md) - Encodage pixels CPC

## 🎯 Fonctionnalités
```

## 🎯 Fonctionnalités

- **Traitement d'images** : Ajustements de luminosité, contraste, saturation
- **Quantification de palette** : Conversion vers palettes couleur spécifiques
- **Architecture adaptateur** : Support CPU/GPU avec fallback intelligent
- **Performance optimisée** : Monitoring et benchmarks intégrés

## 📚 Documentation

→ **[Documentation complète dans `/docs`](./docs/)**

- **[Guide de Développement](./docs/DEVELOPMENT_GUIDE.md)** : Documentation principale et référence
- **[Index de Documentation](./docs/DOCUMENTATION_INDEX.md)** : Navigation et organisation

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

**Phase 1 - Exports Essentiels** (2 semaines)
- [ ] Export ASM avec code assembleur configurable
- [ ] Export DSK (images disque Amstrad)
- [ ] Dialog SaveMedia avec presets

**Phase 2 - UI/UX Avancée** (1-2 semaines)
- [ ] 5 modes de redimensionnement (Fit, KeepSmaller, KeepLarger, UserSize, Origin)
- [ ] Taille destination personnalisée avec validation 64Ko
- [ ] Presets CPC (Standard, Overscan, modes 0/1/2)
- [ ] Boutons ×2/÷2 pour dimensions

**Phase 3 - Exports Avancés** (2-3 semaines)
- [ ] Format CMP avec compression (ZX0, ZX1, Standard)
- [ ] Format KIT (palettes CPC Plus 12-bit)
- [ ] Format IMP (split-screen)
- [ ] Format Tiles avec déduplication

**Phase 4 - Fonctionnalités Avancées** (3-4 semaines)
- [ ] Dithering personnalisé (patterns, intensité)
- [ ] Distance RGB pondérée
- [ ] Lissage horizontal anti-aliasing
- [ ] Gestion animations et sprites

**Phase 5 - Optimisations** (2 semaines)
- [ ] GPU complete (Lab/XYZ colorspaces)
- [ ] Batch processing multiple images
- [ ] Web Workers pour threading
- [ ] Cache amélioré

> **Voir** [CONVIMGCPC_UI_EXPORT_ANALYSIS.md](./docs/analysis/CONVIMGCPC_UI_EXPORT_ANALYSIS.md) pour détails complets

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

### Workflow
1. **Fork** le projet
2. **Créer une branche** : `git checkout -b feature/amazing-feature`
3. **Lire la documentation** : Consulter [QUICK_START_GUIDE.md](./docs/QUICK_START_GUIDE.md)
4. **Développer** : Suivre les patterns dans [copilot-instructions.md](./.github/copilot-instructions.md)
5. **Tester** : `pnpm test` et `pnpm typecheck`
6. **Commit** : Messages clairs et structurés
7. **Push** : `git push origin feature/amazing-feature`
8. **Pull Request** : Description détaillée des changements

### Standards de Code
- ✅ TypeScript strict mode
- ✅ Biome linting (0 erreurs/warnings)
- ✅ Tests co-localisés (`.spec.tsx`)
- ✅ CSS Modules pour styling
- ✅ Jotai atoms (pas de prop drilling)
- ✅ Props readonly
- ✅ RefObject pattern pour refs

### Où Contribuer ?

**Quick Wins** (faciles, impact élevé) :
- Distance RGB pondérée (perception visuelle)
- Lissage horizontal anti-aliasing
- Tri de palette par fréquence
- Export formats additionnels

**Features Majeures** :
- GPU Lab/XYZ colorspaces
- Système compression (ZX0, ZX1)
- Éditeur de dithering patterns
- Animations et sprites

> **Voir** [Roadmap](#-roadmap) pour la liste complète

## 🐛 Bugs et Questions

- **Issues** : Utiliser [GitHub Issues](https://github.com/IIIvan37/pixsaur/issues)
- **Discussions** : Proposer des features ou poser des questions
- **Documentation** : Améliorer les docs dans `/docs`

## 📄 License

MIT License - Voir [LICENSE](./LICENSE) pour détails

---

## 🔗 Liens Utiles

- **Amstrad CPC** : [CPCWiki](http://www.cpcwiki.eu/)
- **CPC Plus** : [Plus Documentation](http://www.cpcwiki.eu/index.php/Arnold_V_specs_revised)
- **ConvImgCpc** : [Outil de référence](https://github.com/cpcsdk/convimgcpc) (analyse compétitive)
- **ReGL** : [GPU programming](https://github.com/regl-project/regl)

---

**Fait avec ❤️ pour la communauté Amstrad CPC**
