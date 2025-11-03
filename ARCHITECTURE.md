# Architecture Pixsaur avec Netlify Functions

## Vue d'ensemble

Pixsaur est maintenant équipé d'une API serverless via Netlify Functions pour fournir des fonctionnalités avancées d'export.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Image Processing (Client-Side)                      │   │
│  │  - WebGL/CPU dithering                              │   │
│  │  - Color quantization                               │   │
│  │  - Basic exports (SCR, PNG, etc.)                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Client (src/libs/api-client.ts)                │   │
│  │  - Type-safe API calls                              │   │
│  │  - Base64 encoding/decoding                         │   │
│  │  - File download helpers                            │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Netlify Functions (Serverless)                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   /assemble    │  │  /create-dsk   │  │ /create-sna  │  │
│  │  Z80 Assembly  │  │  Disk Images   │  │  Snapshots   │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│           │                   │                   │          │
│           ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              RASM Integration (Future)               │   │
│  │  - WebAssembly module                               │   │
│  │  - Z80 assembler                                    │   │
│  │  - DSK/SNA format writers                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Structure des fichiers

```
pixsaur/
├── netlify/                        # Netlify Functions backend
│   ├── functions/                  # Serverless functions
│   │   ├── health.ts              # API health check
│   │   ├── assemble.ts            # Z80 assembly (RASM)
│   │   ├── create-dsk.ts          # DSK creation
│   │   └── create-sna.ts          # SNA creation
│   ├── types.ts                   # Shared TypeScript types
│   ├── README.md                  # API documentation
│   ├── RASM_INTEGRATION.md        # RASM integration guide
│   └── .gitignore
│
├── src/
│   ├── libs/
│   │   └── api-client.ts          # Frontend API client
│   └── components/
│       └── advanced-export/        # Advanced export UI
│           ├── advanced-export-panel.tsx
│           └── index.ts
│
└── netlify.toml                    # Netlify configuration
```

## Flux de données

### Export DSK

1. **Frontend**: Utilisateur clique sur "Export as DSK"
2. **Component**: `AdvancedExportPanel` récupère l'image depuis l'état
3. **API Client**: Encode en base64 et envoie à `/create-dsk`
4. **Function**: Crée le fichier DSK avec format AMSDOS
5. **Response**: Retourne le DSK en base64
6. **Frontend**: Télécharge automatiquement le fichier

### Export SNA

1. **Frontend**: Utilisateur clique sur "Export as SNA"
2. **Component**: `AdvancedExportPanel` prépare les données binaires
3. **API Client**: Envoie à `/create-sna` avec adresses mémoire
4. **Function**: Crée le snapshot SNA v3
5. **Response**: Retourne le SNA en base64
6. **Frontend**: Télécharge automatiquement le fichier

### Assembly

1. **Frontend**: Utilisateur écrit du code Z80 ou génère automatiquement
2. **API Client**: Envoie le code à `/assemble`
3. **Function**: Utilise RASM (WASM) pour assembler
4. **Response**: Retourne le binaire + symboles
5. **Frontend**: Peut créer DSK/SNA avec le binaire

## Types partagés

Les types sont définis dans `netlify/types.ts` et utilisés à la fois par:

- Les Netlify Functions (backend)
- L'API Client (frontend)

Cela garantit la cohérence des contrats d'API.

## Environnement de développement

### Local

```bash
# Terminal 1: Frontend dev server
pnpm dev

# Terminal 2: Netlify Functions (quand implémenté)
netlify dev
```

### Production

- Frontend: Déployé sur Netlify CDN
- Functions: Déployées automatiquement comme serverless functions
- Pas de serveur à gérer !

## Prochaines étapes d'implémentation

### Phase 1: Infrastructure ✅

- [x] Configuration Netlify
- [x] Structure des functions
- [x] Types TypeScript partagés
- [x] API Client frontend
- [x] Composant UI de base

### Phase 2: RASM Integration 🚧

- [ ] Compiler RASM en WebAssembly
- [ ] Wrapper TypeScript pour RASM WASM
- [ ] Tests d'assemblage basiques
- [ ] Documentation API RASM

### Phase 3: Formats DSK/SNA 🚧

- [ ] Implémentation format DSK (DATA + EXTENDED)
- [ ] Support AMSDOS headers
- [ ] Implémentation format SNA v3
- [ ] Configuration Z80 registers
- [ ] Tests avec émulateurs

### Phase 4: Intégration UI 🚧

- [ ] Connexion avec l'état de Pixsaur
- [ ] Génération automatique de code assembleur
- [ ] Preview avant export
- [ ] Options avancées (adresses mémoire, etc.)
- [ ] Internationalisation

### Phase 5: Features avancées 🔮

- [ ] Génération de loaders BASIC
- [ ] Support multi-fichiers DSK
- [ ] Compression des données
- [ ] Templates de projets CPC
- [ ] Export de séquences animées

## Avantages de cette architecture

### Séparation des préoccupations

- Frontend: Image processing, UI/UX
- Backend: Formats complexes, assemblage

### Scalabilité

- Serverless = pas de limites de charge
- CDN = distribution mondiale rapide
- Pas de serveur à maintenir

### Sécurité

- WASM = sandboxé
- Pas d'exécution de code utilisateur côté client
- Validation côté serveur

### Évolutivité

- Facile d'ajouter de nouveaux formats
- API versionnée
- Backward compatibility

## Resources

- [Documentation Netlify Functions](https://docs.netlify.com/functions/overview/)
- [RASM GitHub](https://github.com/EdouardBERGE/rasm)
- [Formats Amstrad CPC](http://www.cpcwiki.eu/)
- [WebAssembly](https://webassembly.org/)
