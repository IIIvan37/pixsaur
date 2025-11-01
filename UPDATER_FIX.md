# 🔧 Fix pour l'updater - Fichiers manquants (toutes plateformes)

## ❌ Problème identifié

Le fichier `latest.json` de votre release v0.1.9 pointe vers les mauvais formats de fichiers :

```json
{
  "platforms": {
    "linux-x86_64": {
      "url": "...Pixsaur_0.1.9_amd64.AppImage" // ❌ Mauvais
    },
    "windows-x86_64": {
      "url": "...Pixsaur_0.1.9_x64-setup.exe" // ❌ Mauvais
    },
    "darwin-aarch64": {
      "url": "...Pixsaur_0.1.9_aarch64.dmg" // ❌ Mauvais
    }
  }
}
```

**L'updater Tauri a besoin de fichiers compressés et signés :**

- Linux : `.AppImage.tar.gz` (pas `.AppImage`)
- Windows : `.nsis.zip` (pas `.exe`)
- macOS : `.app.tar.gz` (pas `.dmg`)

## ✅ Solution

### 1. Vérifier que les fichiers `.app.tar.gz` sont générés

Lors du build avec `pnpm tauri build`, Tauri devrait générer automatiquement les fichiers d'updater si `createUpdaterArtifacts` est à `true` (ce qui est le cas dans votre config).

Les fichiers devraient être dans :

```
src-tauri/target/release/bundle/macos/
```

Cherchez des fichiers comme :

- `Pixsaur_aarch64.app.tar.gz`
- `Pixsaur_aarch64.app.tar.gz.sig`
- `Pixsaur_x64.app.tar.gz`
- `Pixsaur_x64.app.tar.gz.sig`

### 2. Si les fichiers `.app.tar.gz` ne sont pas générés

C'est probablement parce que vous utilisez un workflow CI/CD qui ne génère que les `.dmg`. Vous devez :

**Option A : Build local**

```bash
# Sur votre Mac Apple Silicon
pnpm tauri build --target aarch64-apple-darwin

# Vérifier les fichiers générés pour toutes les plateformes
ls -lh src-tauri/target/aarch64-apple-darwin/release/bundle/macos/
ls -lh src-tauri/target/release/bundle/appimage/
ls -lh src-tauri/target/release/bundle/nsis/
```

**Option B : Modifier votre workflow CI/CD**

Si vous utilisez GitHub Actions, assurez-vous que le workflow génère les artifacts d'updater. Vérifiez votre fichier `.github/workflows/*.yml`.

### 3. Upload manuel des fichiers manquants

Une fois tous les fichiers updater générés :

1. Allez sur https://github.com/IIIvan37/pixsaur/releases/tag/v0.1.9
2. Cliquez sur "Edit release"
3. Uploadez les fichiers pour **toutes les plateformes** :

**macOS :**

- `Pixsaur_aarch64.app.tar.gz`
- `Pixsaur_aarch64.app.tar.gz.sig`
- `Pixsaur_x64.app.tar.gz`
- `Pixsaur_x64.app.tar.gz.sig`

**Linux :**

- `Pixsaur_0.1.9_amd64.AppImage.tar.gz`
- `Pixsaur_0.1.9_amd64.AppImage.tar.gz.sig`

**Windows :**

- `Pixsaur_0.1.9_x64-setup.nsis.zip`
- `Pixsaur_0.1.9_x64-setup.nsis.zip.sig`

### 4. Mettre à jour le fichier latest.json

Le fichier doit pointer vers les fichiers `.tar.gz` / `.zip` pour **toutes les plateformes** :

```json
{
  "version": "v0.1.9",
  "notes": "See release notes at https://github.com/IIIvan37/pixsaur/releases/tag/v0.1.9",
  "pub_date": "2025-11-01T04:14:29+01:00",
  "platforms": {
    "linux-x86_64": {
      "signature": "CONTENU_DU_FICHIER_.sig",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_0.1.9_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "CONTENU_DU_FICHIER_.sig",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_0.1.9_x64-setup.nsis.zip"
    },
    "darwin-x86_64": {
      "signature": "CONTENU_DU_FICHIER_.sig",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "CONTENU_DU_FICHIER_.sig",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_aarch64.app.tar.gz"
    }
  }
}
```

**Important :** La signature doit être le contenu du fichier `.sig` correspondant.

**Astuce :** Utilisez le script fourni pour générer le template :

````bash
./scripts/generate-latest-json.sh
```### 5. Tester localement

Après avoir uploadé les bons fichiers :

```bash
# Vérifier que les fichiers sont accessibles
curl -I https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_aarch64.app.tar.gz

# Vérifier latest.json
curl -s https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/latest.json | python3 -m json.tool

# Lancer le script de vérification
./scripts/check-updater-config.sh
````

## 🔍 Comment éviter ce problème à l'avenir

### Automatiser avec GitHub Actions

Créez un workflow qui :

1. Build l'app pour toutes les plateformes
2. Génère automatiquement `latest.json` avec les bons chemins
3. Upload tous les fichiers (`.dmg` ET `.app.tar.gz`)

Exemple de commande pour générer latest.json après le build :

```bash
# Tauri génère automatiquement latest.json dans le dossier bundle
# Il faut juste s'assurer de l'uploader
```

### Vérifier avant de publier

Avant de publier une release, vérifiez toujours :

```bash
# Lister tous les fichiers générés
find src-tauri/target -name "*.app.tar.gz*" -o -name "latest.json"

# Vérifier le contenu de latest.json
cat src-tauri/target/release/bundle/macos/latest.json
```

## 📝 Résumé

**Pourquoi ça ne marche pas :**

- ✅ L'updater **détecte** la mise à jour (latest.json existe)
- ❌ L'updater **ne peut pas installer** (les fichiers .app.tar.gz n'existent pas)
- ⚠️ Les fichiers .dmg ne peuvent pas être utilisés par l'updater

**Ce qu'il faut faire :**

1. Builder localement sur votre Mac : `pnpm tauri build --target aarch64-apple-darwin`
2. Trouver les fichiers `.app.tar.gz` et `.sig` dans `src-tauri/target/`
3. Les uploader sur la release GitHub
4. Mettre à jour `latest.json` avec les bonnes URLs et signatures
5. Tester avec `./scripts/check-updater-config.sh`

## 🚀 Après le fix

Une fois les bons fichiers en place :

- L'updater détectera la mise à jour ✅
- L'updater téléchargera le `.app.tar.gz` ✅
- L'updater installera automatiquement ✅
- L'app redémarrera avec la nouvelle version ✅

Les logs détaillés que j'ai ajoutés au composant updater vous montreront exactement ce qui se passe à chaque étape.
