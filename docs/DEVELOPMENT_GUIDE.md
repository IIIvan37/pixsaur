# Pixsaur - Guide de Développement

## 🎯 Vue d'ensemble

Pixsaur est une application de traitement d'images avec quantification de palette, utilisant une architecture adaptateur moderne pour supporter différentes implémentations (CPU, ReGL/GPU).

## 🏗️ Architecture Actuelle

### Structure des Adaptateurs
```
src/libs/pixsaur-adapter/
├── adapters/
│   ├── cpu-processor.ts          # Implémentation CPU (stable)
│   └── regl-processor.ts         # Implémentation ReGL (future GPU)
├── interfaces.ts                 # Définitions TypeScript
├── factory.ts                    # Factory pattern + cache
└── webgl-detection.ts           # Détection capacités WebGL
```

### Types de Processors
- **CPU Processor** : Implémentation stable et fiable (fallback par défaut)
- **ReGL Processor** : Future implémentation GPU avec fallback CPU intelligent

## 🎮 ReGL comme Future GPU

### Philosophie
ReGL est notre choix pour l'accélération GPU future car :
- API fonctionnelle plus simple que WebGL natif
- Meilleure gestion des ressources
- Debugging amélioré
- Abstraction plus robuste

### État Actuel
Le ReGL processor est configuré avec **fallback CPU intelligent** :
- Essaie d'initialiser ReGL si disponible
- Fallback vers CPU si ReGL non disponible
- Préparé pour l'implémentation GPU future

## 🚀 Utilisation

### Factory Pattern
```typescript
import { processorFactory } from '@/libs/pixsaur-adapter'

// Sélection automatique du meilleur processor
const processor = processorFactory.createBestProcessor()

// Traitement d'image
const adjustedImage = await processor.applyAdjustments(imageData, {
  brightness: 0.1,
  contrast: 0.2,
  saturation: 0.3,
  posterization: 0
})

// Quantification de palette
const palette = await processor.quantizePalette(
  buffer, cropped, targetColors, basePalette, lockedVecs, colorSpace
)
```

### Sélection Intelligente
La factory sélectionne automatiquement :
1. **ReGL Processor** si WebGL disponible et recommandé
2. **CPU Processor** comme fallback fiable

## 📊 Système de Logging

### Loggers Spécialisés
```typescript
import { adapterLogger, quantizerLogger, paletteLogger } from '@/utils/logger'

// Logging avec timing automatique
adapterLogger.timeAsync('Operation', async () => {
  // operation
})

// Logging avec émojis structurés
adapterLogger.info('🎮 [ADAPTER] ReGL initialized')
quantizerLogger.debug('📊 [QUANTIZER] Creating quantizer')
paletteLogger.warn('⚠️ [PALETTE] Expected 16 colors but got 12')
```

### Conventions
- **🎮 [ADAPTER]** : Opérations de l'adaptateur
- **📊 [QUANTIZER]** : Quantification
- **🎨 [PALETTE]** : Gestion des palettes
- **🏭 [FACTORY]** : Factory operations

## 🔧 Développement

### Ajout d'un Nouveau Processor

1. **Créer le processor** dans `src/libs/pixsaur-adapter/adapters/`
2. **Implémenter** l'interface `ImageProcessor`
3. **Ajouter le type** dans `interfaces.ts`
4. **Mettre à jour** la factory

### Tests et Validation
```bash
# Type checking
pnpm typecheck

# Build complet
pnpm build

# Tests
pnpm test

# Dev server
pnpm dev
```

## 📈 Performance et Monitoring

### Benchmarks CPU Actuels
- **Ajustements** : ~37ms
- **Quantification** : ~408-431ms  
- **Pipeline total** : ~1263ms (image 766x800px)

### Objectifs GPU Future
- **Minimum** : 2x plus rapide (632ms total)
- **Recommandé** : 4x plus rapide (316ms total)
- **Excellent** : 6x plus rapide (210ms total)

## 🎯 Roadmap

### Phase 1 : Architecture Stable ✅
- Architecture adaptateur fonctionnelle
- CPU processor stable
- ReGL processor avec fallback CPU
- Système de logging complet

### Phase 2 : Implémentation GPU (À venir)
- Shaders ReGL pour ajustements d'image
- Quantification GPU avec ReGL
- Tests de performance GPU vs CPU
- Optimisations spécifiques

### Phase 3 : Optimisations Avancées (Future)
- Compute shaders avancés
- Pipeline GPU optimisé
- Gestion mémoire GPU
- Fallback intelligence améliorée

## 🛠️ Guidelines de Développement

### Principes
1. **Fallback CPU fiable** : Toujours garder CPU comme fallback
2. **Logging exhaustif** : Tracer toutes les opérations importantes
3. **Interface unifiée** : Même API peu importe l'implémentation
4. **Performance monitoring** : Mesurer et comparer les performances

### Bonnes Pratiques
- Utiliser les loggers spécialisés avec émojis
- Implémenter des fallbacks gracieux
- Tester sur différentes configurations WebGL
- Documenter les choix architecturaux

## 📚 Documentation Technique

### Fichiers de Référence
- `ADAPTER_ARCHITECTURE.md` : Architecture détaillée
- `LOGGING_PATTERNS.md` : Patterns de logging
- `docs/BENCHMARK_TOOLS.md` : Outils de performance

### Types et Interfaces
Voir `src/libs/pixsaur-adapter/interfaces.ts` pour les définitions complètes.

---

*Cette documentation sert de référence principale pour le développement de Pixsaur. Elle sera mise à jour au fur et à mesure de l'évolution du projet.*