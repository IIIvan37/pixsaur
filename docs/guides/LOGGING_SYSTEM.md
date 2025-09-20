# Système de Logging Pixsaur

## Vue d'ensemble

Le système de logging de Pixsaur est conçu pour être **performant**, **configurable** et **inactif en production** par défaut. Il fournit des mesures de performance détaillées pour optimiser le pipeline CPU/GPU.

## Caractéristiques

- ✅ **Inactif en production** : Désactivé automatiquement sauf configuration explicite
- ✅ **Timers intégrés** : Mesure automatique des temps d'exécution
- ✅ **Loggers spécialisés** : Différents domaines (Adapter, WebGL, Quantizer, Palette)
- ✅ **Interface de contrôle** : Panneau debug pour configurer en temps réel
- ✅ **Performance zéro** : Aucun impact si désactivé

## Utilisation rapide

### Import des loggers
```typescript
import { 
  logger,           // Logger principal
  adapterLogger,    // Adaptateur CPU/GPU
  webglLogger,      // Operations WebGL
  quantizerLogger,  // Quantization
  paletteLogger,    // Génération palette
  measure          // Helpers pour mesurer
} from '@/utils/logger'
```

### Mesures de performance
```typescript
// Mesure automatique avec timeSync
const result = quantizerLogger.timeSync('My Operation', () => {
  return doExpensiveWork()
})

// Mesure async
const result = await quantizerLogger.timeAsync('Async Operation', async () => {
  return await doAsyncWork()
})

// Mesure manuelle
quantizerLogger.time('Manual Timer')
doWork()
quantizerLogger.timeEnd('Manual Timer') // Affiche le temps
```

### Helpers spécialisés
```typescript
// Mesures prédéfinies pour domaines critiques
const palette = measure.quantization(() => quantizer.quantize(16))
const adapted = measure.adaptation(() => processor.adapt())
const webglResult = measure.webgl(() => renderer.process())
const paletteData = measure.palette(() => generatePalette())
```

### Logs classiques
```typescript
logger.debug('Information détaillée')
logger.info('Information générale')
logger.warn('Avertissement')
logger.error('Erreur critique')

// Groupement
logger.group('Process Complex')
logger.info('Step 1')
logger.info('Step 2')
logger.groupEnd()
```

## Configuration

### Via React Hook
```typescript
import { useLogger } from '@/hooks/use-logger'

function MyComponent() {
  const { 
    setLoggingEnabled,     // Activer/désactiver tout
    setLogLevel,           // debug/info/warn/error
    setTimingEnabled,      // Activer/désactiver timers
    configureLogging,      // Configuration complète
    clearAllTimers,        // Nettoyer timers
    getPerformanceStats    // Statistiques actuelles
  } = useLogger()
  
  // Exemples
  setLoggingEnabled(true)
  setLogLevel('debug')
  setTimingEnabled(false)
}
```

### Configuration directe
```typescript
import { logger, createLogger } from '@/utils/logger'

// Configurer le logger principal
logger.configure({
  enabled: true,
  level: 'debug',
  enableTiming: true
})

// Créer un logger personnalisé
const myLogger = createLogger({
  prefix: '[MyFeature]',
  level: 'info'
})
```

## Interface utilisateur

### Debug Panel
Le composant `<DebugPanel />` est automatiquement affiché en développement :

- ✅ Activer/désactiver le logging
- ✅ Activer/désactiver les timers
- ✅ Changer le niveau de log
- ✅ Voir les timers actifs en temps réel
- ✅ Nettoyer les timers
- ✅ Auto-masqué en production

### Placement
```tsx
// Déjà intégré dans App.tsx
<DebugPanel />
```

## Loggers spécialisés

### AdapterLogger
```typescript
import { adapterLogger } from '@/utils/logger'

// Utilisation dans les processors
const result = adapterLogger.timeSync('CPU Quantization', () => {
  return cpuProcessor.quantize(data)
})
```

### WebGLLogger  
```typescript
import { webglLogger } from '@/utils/logger'

// Suivi des opérations GPU
webglLogger.info('WebGL initialized')
const adjusted = webglLogger.timeSync('GPU Adjustments', () => {
  return renderer.applyAdjustments(imageData, config)
})
```

### QuantizerLogger
```typescript
import { quantizerLogger } from '@/utils/logger'

// Pipeline de quantization
quantizerLogger.time('Quantizer Creation')
const quantizer = createQuantizer(config)
quantizerLogger.timeEnd('Quantizer Creation')

quantizerLogger.time('Palette Generation')
const palette = quantizer.quantize(16)
quantizerLogger.timeEnd('Palette Generation')
```

### PaletteLogger
```typescript
import { paletteLogger } from '@/utils/logger'

// Génération et conversion de palettes
const rgbPalette = paletteLogger.timeSync('RGB Conversion', () => {
  return palette.map(color => toRGB(color))
})
```

## Intégration pipeline existant

### Preview Pipeline (preview.ts)
```typescript
// Remplacement des console.time/timeEnd
quantizerLogger.time('Quantizer Creation')
// ... création quantizer
quantizerLogger.timeEnd('Quantizer Creation')

// Mesure complète avec measure helper
const result = measure.quantization(() => {
  quantizerLogger.info('Starting Preview Generation')
  // ... logique preview
  return finalImageData
})
```

### Adaptateurs (adapters/)
```typescript
// CPU Processor
const result = adapterLogger.timeSync('CPU Image Adjustments', () => {
  return applyAdjustmentsInOnePass(imageData, adjustments)
})

// WebGL Processor  
return webglLogger.timeSync('WebGL GPU Adjustments', () => {
  return this.renderer!.applyAdjustments(imageData, adjustments)
})

// Hybrid Processor
adapterLogger.warn('WebGL adjustment failed, falling back to CPU:', error)
```

## Performance

### Mode production
```typescript
// Toutes ces calls sont no-op si disabled
logger.time('test')           // -> return immédiatement
logger.timeEnd('test')        // -> return immédiatement  
logger.info('message')        // -> return immédiatement
measure.quantization(fn)      // -> return fn() directement
```

### Mode développement
```typescript
// Logs complets avec timers
[Quantizer] Quantizer Creation: 45.32ms
[Palette] RGB Conversion: 12.84ms
[WebGL] GPU Adjustments: 8.91ms
[Adapter] Hybrid Processor Creation: 2.34ms
```

## Exemples concrets

### Mesurer tout le pipeline de quantization
```typescript
export const reducedPaletteRawAtom = atom<Vector[]>((get) => {
  const quantizer = get(quantizerAtom)
  const mode = get(modeAtom)
  if (!quantizer) return []
  
  return paletteLogger.timeSync('Palette Quantization', () => {
    const raw = quantizer.quantize(CPC_MODE_CONFIG[mode].nColors)
    return raw.map((v) => [...v] as Vector)
  })
})
```

### Fallback avec logging
```typescript
if (this.webglProcessor?.isAvailable) {
  try {
    return (this.webglProcessor as any).applyAdjustmentsSync(imageData, adjustments)
  } catch (error) {
    adapterLogger.warn('WebGL adjustment failed, falling back to CPU:', error)
    // fallback CPU
  }
}
```

### Statistiques en temps réel
```typescript
const { getPerformanceStats } = useLogger()

// Obtenir les timers actifs
const stats = getPerformanceStats()
console.log(stats)
// {
//   quantizer: ['Palette Quantization', 'Dithering'],
//   adapter: ['CPU Quantization'],
//   webgl: [],
//   palette: ['RGB Conversion']
// }
```

## Configuration avancée

### Logger personnalisé pour nouveau domaine
```typescript
const myLogger = createLogger({
  prefix: '[MyDomain]',
  level: 'debug',
  enabled: import.meta.env.DEV,
  enableTiming: true
})
```

### Configuration globale
```typescript
// Désactiver complètement en production
if (import.meta.env.PROD) {
  logger.configure({ enabled: false })
  adapterLogger.configure({ enabled: false })
  webglLogger.configure({ enabled: false })
  quantizerLogger.configure({ enabled: false })
  paletteLogger.configure({ enabled: false })
}
```

### Override pour debug production
```typescript
// Activer temporairement en production pour debug
localStorage.setItem('pixsaur-debug', 'true')
logger.configure({ enabled: true })
```

Ce système de logging permettra de mesurer précisément les performances de chaque partie du pipeline et d'optimiser intelligemment le système CPU/GPU selon les besoins.