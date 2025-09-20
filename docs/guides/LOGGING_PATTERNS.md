# Patterns de Logging - Pixsaur

## Vue d'ensemble

Le système de logging de Pixsaur utilise des loggers spécialisés avec préfixes automatiques pour une observabilité maximale du processing d'images.

## Loggers disponibles

### 1. Logger global
```typescript
import { logger } from '@/utils/logger'
logger.info('Message général')
```

### 2. Loggers spécialisés
```typescript
import { adapterLogger, quantizerLogger, paletteLogger } from '@/utils/logger'
```

| Logger | Préfixe | Usage |
|--------|---------|-------|
| `adapterLogger` | `[Adapter]` | Factory, processeurs, cache |
| `quantizerLogger` | `[Quantizer]` | Création et utilisation quantizers |
| `paletteLogger` | `[Palette]` | Résultats de quantization |

## Conventions de nommage

### Préfixes de messages

| Préfixe | Signification | Exemple |
|---------|---------------|---------|
| `🏭 [FACTORY]` | Opérations factory | `🏭 [FACTORY] Creating best processor` |
| `🖥️ [ADAPTER]` | Adaptateur CPU | `🖥️ [ADAPTER] CPU Image Adjustments` |
| `🎮 [WEBGL]` | Adaptateur WebGL | `🎮 [WEBGL] GPU Acceleration enabled` |
| `🔧 [ADAPTER]` | Création quantizer | `🔧 [ADAPTER] Quantizer Creation` |
| `📊 [DIRECT]` | Système legacy | `📊 [DIRECT] Creating quantizer directly` |

### Émojis par type d'opération

| Émoji | Type | Usage |
|-------|------|-------|
| 🏗️ | Création | Instanciation d'objets |
| ♻️ | Réutilisation | Cache hit |
| 🎨 | Processing | Traitement d'image |
| 🎯 | Quantization | Réduction de palette |
| ⚡ | Performance | Opérations rapides |
| 🗑️ | Cleanup | Disposal/nettoyage |
| ⚠️ | Warning | Problèmes non-bloquants |
| ❌ | Error | Erreurs critiques |
| ✅ | Success | Opérations réussies |

## Patterns de logging

### 1. Performance Timing

```typescript
// ✅ Bon pattern
adapterLogger.timeSync('🖥️ [ADAPTER] CPU Image Adjustments', () => {
  // opération
})

// ✅ Async version
await adapterLogger.timeAsync('🎯 [ADAPTER] Palette Quantization', async () => {
  // opération async
})
```

### 2. Logging d'état

```typescript
// ✅ Création d'instance
constructor() {
  adapterLogger.info('🏗️ CPU Processor instance created')
}

// ✅ Cache hit/miss
if (this.cpuProcessor) {
  adapterLogger.info('♻️ [FACTORY] Reusing cached CPU processor instance')
} else {
  adapterLogger.info('🖥️ [FACTORY] Creating new CPU processor instance')
}
```

### 3. Logging de paramètres

```typescript
// ✅ Contexte détaillé
adapterLogger.info(`🎨 [ADAPTER] Applying adjustments via CPU processor: brightness=${adjustments.brightness}, contrast=${adjustments.contrast}, saturation=${adjustments.saturation}`)

// ✅ Résultats
paletteLogger.info(`🎨 [ADAPTER] Quantization completed: ${result.length}/${targetColors} colors for ${colorSpace}`)
```

### 4. Warnings et validations

```typescript
// ✅ Warning avec contexte
if (result.length !== targetColors) {
  paletteLogger.warn(`⚠️ [ADAPTER] Expected ${targetColors} colors but got ${result.length} for ${colorSpace}`)
}
```

### 5. Distinction système legacy vs nouveau

```typescript
// ✅ Système legacy
console.log('📊 [DIRECT] Creating quantizer directly (legacy system)')
console.time('🔍 [DIRECT] Quantizer Creation')

// ✅ Nouveau système adaptateur
quantizerLogger.info('🔧 [ADAPTER] Creating quantizer via adapter')
quantizerLogger.time('🔧 [ADAPTER] Quantizer Creation')
```

## Exemples de logs par composant

### Factory logs
```
🏭 [FACTORY] Creating best processor (CPU only for now)
🖥️ [FACTORY] Creating new CPU processor instance
🏗️ CPU Processor instance created
✅ [FACTORY] CPU processor instance created and cached
🧹 [FACTORY] Clearing processor cache...
♻️ [FACTORY] Reusing cached CPU processor instance
```

### CPU Processor logs
```
🎨 [ADAPTER] Applying adjustments via CPU processor: brightness=1, contrast=1, saturation=1
🖥️ [ADAPTER] CPU Image Adjustments: 30.10ms
🎯 [ADAPTER] Starting CPU quantization via adapter: colorSpace=RGB, targetColors=16
📊 [ADAPTER] Creating quantizer with metric: euclidean
🎨 [ADAPTER] Quantization completed via adapter: 16/16 colors for RGB
🗑️ [ADAPTER] CPU Processor disposed
```

### Système legacy (pour comparaison)
```
📊 [DIRECT] Creating quantizer directly (legacy system)
🔍 [DIRECT] Quantizer Creation: 51.56ms
🎨 [DIRECT] Quantizing palette directly (legacy system)
🎨 [DIRECT] Palette Quantization: 450.82ms
```

## Configuration du logging

### Niveaux de log
```typescript
import { adapterLogger } from '@/utils/logger'

// Changer le niveau
adapterLogger.configure({ level: 'debug' })

// Désactiver temporairement
adapterLogger.configure({ enabled: false })
```

### Création de loggers personnalisés
```typescript
import { createLogger } from '@/utils/logger'

const webglLogger = createLogger({ 
  prefix: '[WebGL]',
  level: 'info'
})
```

## Bonnes pratiques

### ✅ À faire

1. **Préfixes cohérents** : Toujours utiliser `[ADAPTER]`, `[FACTORY]`, etc.
2. **Contexte suffisant** : Inclure paramètres importants
3. **Performance timing** : Utiliser `timeSync`/`timeAsync`
4. **Émojis consistants** : Même émoji pour même type d'opération
5. **Niveaux appropriés** : `info` pour opérations principales, `debug` pour détails

### ❌ À éviter

1. **Logs excessifs** : Ne pas logger chaque petite opération
2. **Informations sensibles** : Pas de données utilisateur dans les logs
3. **Texte non structuré** : Éviter les messages trop verbeux
4. **Console.log direct** : Préférer les loggers spécialisés
5. **Logs en production** : Configurer selon l'environnement

## Debug workflows

### Debugging performance
```typescript
// Rechercher dans console : "[ADAPTER]"
// Compare avec "[DIRECT]" pour voir les gains
```

### Debugging cache
```typescript
// Rechercher : "Reusing cached" vs "Creating new"
// Vérifier que les instances sont bien réutilisées
```

### Debugging quantization
```typescript
// Rechercher : "[ADAPTER] Quantization completed"
// Vérifier : nombre de couleurs obtenues vs demandées
```

Ce système de logging permet un debugging efficace et une évolution progressive de l'architecture.