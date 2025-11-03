# Netlify Functions - Pixsaur API

Backend serverless pour les fonctionnalités avancées d'export Amstrad CPC.

## Architecture

### Fonctions disponibles

#### 1. `/api/health`

Endpoint de santé pour vérifier que l'API fonctionne.

**Méthode:** GET  
**Réponse:**

```json
{
  "message": "Pixsaur API is running",
  "timestamp": "2025-11-02T...",
  "path": "/api/health"
}
```

#### 2. `/api/assemble` (🚧 En développement)

Assemble du code Z80 avec RASM.

**Méthode:** POST  
**Body:**

```json
{
  "code": "ORG &4000\nLD A,1\nRET"
}
```

**Réponse:**

```json
{
  "success": true,
  "binary": "...", // Base64 encoded binary
  "symbols": {...}
}
```

#### 3. `/api/create-dsk` (🚧 En développement)

Crée un fichier DSK Amstrad CPC contenant plusieurs fichiers.

**Méthode:** POST  
**Body:**

```json
{
  "files": [
    {
      "name": "IMAGE.SCR",
      "data": "...", // Base64
      "type": "binary"
    }
  ],
  "format": "DATA" // ou "EXTENDED"
}
```

**Réponse:** Fichier DSK binaire

#### 4. `/api/create-sna` (🚧 En développement)

Crée un snapshot SNA pour émulateurs.

**Méthode:** POST  
**Body:**

```json
{
  "binary": "...", // Base64 encoded binary
  "loadAddress": 16384,
  "startAddress": 16384
}
```

**Réponse:** Fichier SNA binaire

## Intégration RASM

### Options envisagées

1. **WASM (WebAssembly)** ⭐ Recommandé

   - Compiler RASM en WASM
   - Exécution rapide côté serveur
   - Pas de dépendances système

2. **Binaire natif**

   - Utiliser RASM précompilé
   - Nécessite l'upload du binaire
   - Limité à l'architecture du serveur Netlify

3. **Port JavaScript**
   - Réécrire les fonctionnalités critiques en JS/TS
   - Plus maintenable long terme
   - Effort de développement important

### Prochaines étapes

- [ ] Compiler RASM en WASM ou trouver une version existante
- [ ] Implémenter la création de DSK (format AMSDOS)
- [ ] Implémenter la création de SNA (v3 format)
- [ ] Ajouter la génération automatique de code assembleur pour l'affichage d'images
- [ ] Créer l'interface UI dans Pixsaur

## Développement local

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Démarrer le serveur de dev avec les functions
netlify dev
```

Les functions seront disponibles sur `http://localhost:8888/.netlify/functions/`

## Déploiement

Le déploiement est automatique via Netlify lors du push sur la branche principale.

## Resources

- [RASM Documentation](https://github.com/EdouardBERGE/rasm)
- [Amstrad CPC DSK Format](http://www.cpcwiki.eu/index.php/Format:DSK_disk_image_file_format)
- [SNA Format](http://www.cpcwiki.eu/index.php/Format:SNA_snapshot_file_format)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
