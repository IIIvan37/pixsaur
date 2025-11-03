# Quick Start - Netlify Functions

Guide rapide pour commencer à utiliser les nouvelles fonctionnalités.

## 📦 Ce qui a été installé

```bash
pnpm add -D @netlify/functions  # Types TypeScript pour Netlify Functions
```

## 📁 Fichiers créés

### Backend (Netlify Functions)

- `netlify.toml` - Configuration Netlify
- `netlify/functions/health.ts` - Health check API
- `netlify/functions/assemble.ts` - Assemblage Z80 (à implémenter)
- `netlify/functions/create-dsk.ts` - Création DSK (à implémenter)
- `netlify/functions/create-sna.ts` - Création SNA (à implémenter)
- `netlify/types.ts` - Types partagés

### Frontend

- `src/libs/api-client.ts` - Client API
- `src/components/advanced-export/` - Composant UI

### Documentation

- `ARCHITECTURE.md` - Architecture complète
- `ROADMAP.md` - Plan de développement
- `NETLIFY_SETUP.md` - Résumé de l'installation
- `netlify/README.md` - Documentation API
- `netlify/RASM_INTEGRATION.md` - Guide RASM
- `netlify/EXAMPLES.md` - Exemples d'utilisation

### Outils

- `netlify/test-functions.sh` - Script de test

## 🚀 Démarrage rapide

### 1. Installer Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. Démarrer le serveur de développement

```bash
cd /Users/ivanduchauffour/iiivan/pixsaur
netlify dev
```

Cela va démarrer:

- Frontend sur `http://localhost:8888`
- Functions sur `http://localhost:8888/.netlify/functions/`

### 3. Tester l'API

```bash
# Dans un autre terminal
./netlify/test-functions.sh health
```

Ou avec curl:

```bash
curl http://localhost:8888/.netlify/functions/health
```

## 💻 Utilisation dans le code

### Dans un composant React

```typescript
import { pixsaurApi } from "@/libs/api-client";

// Dans votre composant
const handleExport = async () => {
  try {
    // Vérifier que l'API fonctionne
    const health = await pixsaurApi.health();
    console.log(health);

    // Créer un DSK (quand implémenté)
    const result = await pixsaurApi.createDsk({
      files: [
        {
          name: "IMAGE.SCR",
          data: "base64data...",
          type: "binary",
        },
      ],
      format: "DATA",
    });

    // Télécharger
    if (result.success && result.data) {
      pixsaurApi.downloadFile(
        result.data,
        "image.dsk",
        "application/octet-stream"
      );
    }
  } catch (error) {
    console.error("Export failed:", error);
  }
};
```

### Utiliser le composant existant

```typescript
import { AdvancedExportPanel } from "@/components/advanced-export";

function App() {
  return (
    <div>
      {/* Votre UI existante */}
      <AdvancedExportPanel />
    </div>
  );
}
```

## 📝 Prochaines étapes

### Pour tester localement (sans RASM pour l'instant)

1. **Démarrer Netlify Dev:**

   ```bash
   netlify dev
   ```

2. **L'endpoint health devrait fonctionner:**

   ```bash
   curl http://localhost:8888/.netlify/functions/health
   # {"message":"Pixsaur API is running","timestamp":"...","path":"/health"}
   ```

3. **Les autres endpoints retournent des placeholders:**
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/assemble \
     -H "Content-Type: application/json" \
     -d '{"code":"ORG &4000\nLD A,1"}'
   # {"success":true,"message":"RASM integration coming soon"}
   ```

### Pour implémenter RASM (voir `netlify/RASM_INTEGRATION.md`)

1. **Compiler RASM en WebAssembly**
2. **Créer un wrapper TypeScript**
3. **Mettre à jour `assemble.ts`**
4. **Tester avec du vrai code Z80**

### Pour implémenter DSK/SNA

1. **Étudier les formats** (liens dans documentation)
2. **Implémenter les writers**
3. **Tester avec émulateurs**
4. **Valider avec matériel réel si possible**

## 🔧 Commandes utiles

```bash
# Développement local avec Netlify Dev
netlify dev

# Tester tous les endpoints
./netlify/test-functions.sh all

# Tester un endpoint spécifique
./netlify/test-functions.sh health

# Build local (sans déployer)
pnpm build

# Déployer en production (si configuré)
netlify deploy --prod

# Voir les logs des functions
netlify functions:log
```

## 📚 Documentation

Pour plus de détails, consultez:

1. **Architecture globale:** `ARCHITECTURE.md`
2. **Plan de développement:** `ROADMAP.md`
3. **Guide RASM:** `netlify/RASM_INTEGRATION.md`
4. **Exemples d'utilisation:** `netlify/EXAMPLES.md`
5. **API Reference:** `netlify/README.md`

## ❓ FAQ

### Les functions ne démarrent pas en local

```bash
# Vérifier que Netlify CLI est installé
netlify --version

# Réinstaller si nécessaire
npm install -g netlify-cli
```

### Erreur TypeScript avec @netlify/functions

```bash
# Réinstaller les dépendances
pnpm install

# Vérifier que le package est bien installé
pnpm list @netlify/functions
```

### Comment tester sans déployer ?

Utilisez `netlify dev` pour tout tester localement avant de déployer.

### Comment voir les logs en production ?

```bash
netlify functions:log
```

## 🎯 État actuel

✅ **Fonctionnel maintenant:**

- Infrastructure Netlify
- Endpoint health check
- Client API frontend
- Types TypeScript
- Documentation complète

🚧 **À implémenter:**

- Intégration RASM (compilation WASM)
- Logique DSK (format parser/writer)
- Logique SNA (format parser/writer)
- Connexion UI avec état Pixsaur

## 🤝 Besoin d'aide ?

1. Consulter `netlify/EXAMPLES.md` pour des exemples pratiques
2. Lire `ARCHITECTURE.md` pour comprendre l'architecture
3. Voir `ROADMAP.md` pour le plan de développement
4. Ouvrir une issue GitHub si problème

---

**Prêt à coder ! 🚀**
