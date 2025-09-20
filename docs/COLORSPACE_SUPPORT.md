# Colorspace Support Guide - Pixsaur

## 📊 État actuel du support des espaces colorimétriques (Sept 20, 2025)

### ✅ Support Matrix

| Processeur | RGB | Lab | XYZ | Notes |
|------------|-----|-----|-----|-------|
| **CPU Classic** | ✅ | ✅ | ✅ | Support complet, toutes précisions |
| **GPU Classic** | ✅ | ❌ | ❌ | RGB seulement, fallback CPU auto |
| **GPU Plus** | ✅ | ❌ | ❌ | RGB optimisé, fallback CPU auto |

### 🎯 Choix techniques et rationale

#### Pourquoi GPU = RGB seulement ?

**✅ Avantages RGB sur GPU :**
- Calculs simples et rapides (distance euclidienne)
- Pas de conversion colorimétrique complexe
- Optimisations WebGL natives pour textures RGB
- Performance: 15-210ms vs 400-600ms CPU

**❌ Complexités Lab/XYZ sur GPU :**
- Conversions Lab↔RGB: 15+ opérations mathématiques par pixel
- Précision limitée des shaders vs IEEE754 CPU
- Debug difficile des calculs de distance perceptuelle
- Gain de performance marginal vs complexité implémentation

**🔄 Solution adoptée: Auto-fallback transparent**
```typescript
// L'utilisateur ne voit aucune différence
const palette_rgb = await quantizer.quantizePalette(..., 'RGB')  // → GPU
const palette_lab = await quantizer.quantizePalette(..., 'Lab')  // → CPU auto
const palette_xyz = await quantizer.quantizePalette(..., 'XYZ')  // → CPU auto
```

## 🚀 Performance par espace colorimétrique

### RGB (GPU - Recommandé)
- **CPC Classic**: 15-70ms (histogramme + sélection)
- **CPC Plus**: 140-210ms (sélection optimisée, bypass histogramme)
- **Qualité**: Excellente pour la plupart des cas d'usage
- **Utilisation**: Images naturelles, preview rapide

### Lab (CPU - Précision perceptuelle)
- **Performance**: 400-600ms (stable)
- **Qualité**: Distance perceptuelle optimale
- **Utilisation**: Images avec dégradés subtils, skin tones
- **Avantage**: Correspond à la perception humaine des couleurs

### XYZ (CPU - CIE standard)
- **Performance**: 400-600ms (stable)  
- **Qualité**: Standard CIE, base pour autres espaces
- **Utilisation**: Workflows scientifiques, calibration couleur
- **Avantage**: Espace absolu indépendant du device

## 🔧 Guide d'utilisation

### Choisir l'espace optimal selon le contexte

```typescript
// 🚀 Performance maximale - GPU
const paletteRGB = await processor.quantizePalette(
  buffer, imageData, 16, basePalette, [], 'RGB'
)
// → GPU automatique, 15-210ms

// 🎨 Qualité perceptuelle - CPU  
const paletteLab = await processor.quantizePalette(
  buffer, imageData, 16, basePalette, [], 'Lab'
)
// → CPU automatique, 400-600ms

// 🔬 Standard scientifique - CPU
const paletteXYZ = await processor.quantizePalette(
  buffer, imageData, 16, basePalette, [], 'XYZ'  
)
// → CPU automatique, 400-600ms
```

### Cas d'usage recommandés

#### RGB - Usage général (GPU)
```typescript
// Preview temps réel, images naturelles, gaming
if (isPreviewMode || isRealTimeProcessing) {
  colorSpace = 'RGB'  // GPU fast path
}
```

#### Lab - Qualité perceptuelle (CPU)
```typescript  
// Images avec peau humaine, dégradés subtils
if (hasHumanSkinTones || hasSubtleGradients) {
  colorSpace = 'Lab'  // Perceptual accuracy
}
```

#### XYZ - Workflows scientifiques (CPU)
```typescript
// Calibration couleur, conformité standards  
if (isColorCalibration || requiresCIECompliance) {
  colorSpace = 'XYZ'  // CIE standard
}
```

## 📊 Métriques de qualité

### Tests comparatifs (image référence 640x400)

| Espace | Processeur | Temps | Diversité | Perceptuel | Usage |
|--------|------------|-------|-----------|------------|-------|
| RGB | GPU | 70ms | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Général |
| Lab | CPU | 450ms | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Qualité |
| XYZ | CPU | 420ms | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Science |

### Recommandations par type d'image

**📸 Photos naturelles**: RGB (GPU) → Performance + qualité suffisante
**👤 Portraits**: Lab (CPU) → Meilleure gestion skin tones  
**🎨 Art digital**: Lab (CPU) → Transitions couleur naturelles
**📊 Données scientifiques**: XYZ (CPU) → Standard calibré
**🎮 Gaming/Preview**: RGB (GPU) → Performance maximale

## 🔄 Migration et compatibilité

### Code existant (pas de breaking change)
```typescript
// Code existant continue de fonctionner
const palette = await processor.quantizePalette(buffer, imageData, 16, basePalette)
// → RGB par défaut, GPU utilisé

// Nouveau: colorSpace explicite
const palette = await processor.quantizePalette(buffer, imageData, 16, basePalette, [], 'Lab')
// → Lab explicite, CPU utilisé automatiquement
```

### Logs de debugging
```bash
# Console browser - RGB GPU
🎮 [ReGL] GPU quantization completed: 16/16 colors in 70ms

# Console browser - Lab/XYZ CPU  
💻 [CPU] Quantization completed: 16/16 colors in 450ms (Lab colorspace)
```

## 🚀 Future enhancements

### Améliorations prévues
- **WebGPU compute shaders**: Lab/XYZ sur GPU avec WebGPU
- **Worker threads**: CPU Lab/XYZ en background pour UI responsive
- **Adaptive selection**: Auto-choix espace selon type d'image
- **Quality metrics**: Scores automatiques de qualité perceptuelle

### Architecture extensible
Le système actuel permet facilement d'ajouter:
- Nouveaux espaces colorimétriques (HSV, LCH, etc.)
- Nouveaux processeurs (WebGPU, WASM, etc.)  
- Métriques de distance alternatives (Delta-E 2000, etc.)

---

**Conclusion**: Le choix RGB GPU vs Lab/XYZ CPU offre le meilleur compromis performance/qualité selon les besoins. L'auto-fallback transparent garantit une expérience utilisateur fluide sans complexité technique.