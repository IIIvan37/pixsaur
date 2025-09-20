# Outils de Benchmark pour les Adaptateurs

**MOTS-CLÉS:** `benchmark`, `performance`, `measurement`, `adapter`, `CPU`, `WebGL`, `timing`, `quantization`, `baseline`

Ce répertoire contient les outils pour mesurer et comparer les performances des adaptateurs d'image de Pixsaur.

## 🎯 Résumé Rapide - Session AI

### Performance Baseline CPU Actuelle
```
🎨 Ajustements: ~37ms (brightness, contrast, saturation, posterization)
🎯 Quantification: ~408-431ms (RGB, XYZ, Lab color spaces) 
🖼️ Total Pipeline: ~1263ms (image 766x800px)
```

### Objectifs WebGL  
- **Minimum** : 2x plus rapide (632ms total)
- **Recommandé** : 4x plus rapide (316ms total)  
- **Excellent** : 6x plus rapide (210ms total)

### Commande Rapide
```bash
npm run benchmark          # Lance benchmark Node.js (simulation)
npm run benchmark:e2e      # Lance benchmark browser E2E (réel)
npm run benchmark:combined # Lance les deux et génère rapport comparatif
```

## 📊 Baseline des Performances Actuelles

Voir `PERFORMANCE_BASELINE.md` pour les métriques de référence du système CPU actuel.

## 🚀 Script de Benchmark Automatisé

### Installation
```bash
# Le script utilise Node.js natif, aucune dépendance externe requise
node scripts/benchmark-adapters.js
```

### Utilisation

#### Benchmark Standard
```bash
# Lance un benchmark avec la configuration par défaut
node scripts/benchmark-adapters.js
```

#### Configuration
Le script utilise une configuration par défaut optimisée pour les tests :
- **Image de test** : 766x800 pixels (taille réelle de l'app)
- **Itérations** : 5 mesures pour la moyenne
- **Ajustements testés** : brightness, contrast, saturation, posterization
- **Espaces colorimétriques** : RGB, XYZ, Lab
- **Couleurs cibles** : 16 couleurs (palette standard)

### Résultats

#### Format Console
```
📊 BENCHMARK RESULTS
====================
Timestamp: 2024-01-15T10:30:00.000Z
Commit: d131cbe
Image size: 766x800
Iterations: 5

🎨 Image Adjustments:
  Average: 35.67ms
  Range: 28.45ms - 47.23ms

🎯 Palette Quantization:
  RGB: 425.34ms (381.22-557.89ms)
  XYZ: 445.67ms (398.11-578.23ms)
  Lab: 467.89ms (412.34-589.45ms)

🖼️ Total Pipeline:
  Average: 1284.56ms
  Range: 1156.78ms - 1423.89ms
```

#### Fichier JSON
Les résultats sont automatiquement sauvegardés dans un fichier JSON horodaté :
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "commit": "d131cbe",
  "iterations": 5,
  "imageSize": { "width": 766, "height": 800 },
  "adjustments": {
    "times": [35.2, 28.4, 47.2, 33.1, 34.4],
    "average": 35.67,
    "min": 28.4,
    "max": 47.2
  },
  "quantization": {
    "RGB": { "times": [...], "average": 425.34, ... },
    "XYZ": { "times": [...], "average": 445.67, ... },
    "Lab": { "times": [...], "average": 467.89, ... }
  },
  "total": {
    "times": [...],
    "average": 1284.56,
    "min": 1156.78,
    "max": 1423.89
  }
}
```

## 🎯 Objectifs de Performance WebGL

### Cibles d'Amélioration
Basé sur la baseline CPU actuelle :

| Opération | CPU Actuel | Cible WebGL | Amélioration |
|-----------|------------|-------------|--------------|
| Ajustements | ~35ms | ~5-10ms | 3-7x plus rapide |
| Quantification RGB | ~425ms | ~50-100ms | 4-8x plus rapide |
| Quantification XYZ | ~445ms | ~60-120ms | 4-7x plus rapide |
| Quantification Lab | ~467ms | ~70-140ms | 3-6x plus rapide |
| **Pipeline Total** | **~1285ms** | **~200-400ms** | **3-6x plus rapide** |

### Métriques de Validation
Pour considérer l'implémentation WebGL réussie :
- ✅ **Amélioration minimum** : 2x plus rapide que CPU
- 🎯 **Objectif recommandé** : 4x plus rapide que CPU  
- 🚀 **Performance excellente** : 6x plus rapide que CPU

## 📈 Utilisation pour le Développement WebGL

### 1. Avant l'Implémentation
```bash
# Mesurer la baseline CPU
node scripts/benchmark-adapters.js
# Sauvegarder : benchmark-cpu-baseline-YYYY-MM-DD.json
```

### 2. Pendant le Développement
```bash
# Tester les changements régulièrement
node scripts/benchmark-adapters.js
# Comparer avec la baseline
```

### 3. Validation Finale
```bash
# Benchmark final WebGL
node scripts/benchmark-adapters.js
# Calculer les améliorations vs baseline
```

### Comparaison Automatisée
```bash
# Script pour comparer deux fichiers de benchmark
node -e "
const baseline = require('./benchmark-cpu-baseline.json');
const current = require('./benchmark-webgl-latest.json');

console.log('🔍 Performance Comparison');
console.log('CPU vs WebGL improvements:');
console.log(\`Adjustments: \${(baseline.adjustments.average / current.adjustments.average).toFixed(2)}x faster\`);
console.log(\`Quantization RGB: \${(baseline.quantization.RGB.average / current.quantization.RGB.average).toFixed(2)}x faster\`);
console.log(\`Total Pipeline: \${(baseline.total.average / current.total.average).toFixed(2)}x faster\`);
"
```

## 🔧 Intégration Continue

### Variables d'Environnement
- `GIT_COMMIT` : Hash du commit pour traçabilité
- `CI=true` : Mode automatisé sans output coloré

### GitHub Actions (example)
```yaml
- name: Performance Benchmark
  run: |
    export GIT_COMMIT=${{ github.sha }}
    node scripts/benchmark-adapters.js
    
- name: Archive Results
  uses: actions/upload-artifact@v3
  with:
    name: benchmark-results
    path: benchmark-*.json
```

## 📁 Structure des Fichiers

```
/home/iiivan/pixsaur/
├── PERFORMANCE_BASELINE.md      # Métriques de référence CPU
├── scripts/
│   └── benchmark-adapters.js    # Script de benchmark automatisé
└── benchmark-*.json             # Résultats horodatés (gitignore)
```

## 🎛️ Personnalisation

### Modifier la Configuration
Éditer `TEST_CONFIG` dans `benchmark-adapters.js` :
```javascript
const TEST_CONFIG = {
  imageSize: { width: 1024, height: 1024 },  // Image plus grande
  iterations: 10,                            // Plus d'itérations
  adjustments: {
    brightness: 1.2,                        // Ajustements plus intenses
    contrast: 1.3,
    saturation: 0.8,
    posterization: 128
  },
  quantization: {
    targetColors: 32,                       // Plus de couleurs
    colorSpaces: ['RGB', 'Lab']             // Moins d'espaces à tester
  }
}
```

### Intégrer avec de Vrais Adaptateurs
Remplacer les simulations dans `runBenchmark()` :
```javascript
// Au lieu de simulateProcessing()
const adapter = createAdapter(type);
const adjustedImage = await adapter.applyAdjustments(testImage, TEST_CONFIG.adjustments);
const palette = await adapter.quantizePalette(adjustedImage, TEST_CONFIG.quantization);
```