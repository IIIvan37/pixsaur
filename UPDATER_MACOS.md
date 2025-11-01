# Configuration de l'Updater pour macOS (Apple Silicon)

## Problème identifié

L'updater détecte les nouvelles versions mais ne parvient pas à les installer sur macOS Apple Silicon. Cela peut être dû à plusieurs facteurs :

1. **Format du bundle incorrect** : Les fichiers `.app.tar.gz` doivent être générés correctement pour Apple Silicon (architecture `aarch64-apple-darwin`)
2. **Permissions manquantes** : macOS requiert des permissions spécifiques pour installer les mises à jour
3. **Signature de code** : Les applications non signées peuvent être bloquées par Gatekeeper

## Solution appliquée

### 1. Amélioration des logs

Le composant `updater.tsx` a été modifié pour :

- Logger plus de détails sur la mise à jour détectée
- Capturer et afficher les erreurs d'installation
- Afficher un message d'erreur à l'utilisateur en cas d'échec

### 2. Configuration macOS dans tauri.conf.json

Ajout de la section `macOS` dans la configuration du bundle :

```json
"macOS": {
  "minimumSystemVersion": "10.15",
  "entitlements": null,
  "exceptionDomain": null,
  "signingIdentity": null,
  "hardenedRuntime": true
}
```

### 3. Activation du dialogue d'updater

```json
"updater": {
  ...
  "dialog": true
}
```

## Vérification de la release

Pour que l'updater fonctionne correctement sur macOS Apple Silicon, vous devez vous assurer que :

1. **Le fichier `latest.json` contient les bonnes URLs** :

```json
{
  "version": "0.1.9",
  "notes": "Release notes",
  "pub_date": "2024-11-01T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/IIIvan37/pixsaur/releases/download/v0.1.9/Pixsaur_x64.app.tar.gz"
    }
  }
}
```

2. **Les fichiers `.app.tar.gz` sont bien générés lors du build** :

   - Pour Apple Silicon : `Pixsaur_aarch64.app.tar.gz`
   - Pour Intel : `Pixsaur_x64.app.tar.gz`

3. **Les signatures sont générées avec la clé privée** :
   - Utilisez `tauri signer sign` pour signer les fichiers
   - La signature doit correspondre à la clé publique dans `tauri.conf.json`

## Build pour macOS avec Universal Binary

Pour supporter à la fois Apple Silicon et Intel :

```bash
# Build pour les deux architectures
pnpm tauri build --target universal-apple-darwin

# Ou séparément :
pnpm tauri build --target aarch64-apple-darwin  # Apple Silicon
pnpm tauri build --target x86_64-apple-darwin   # Intel
```

## Génération des artifacts d'update

Après le build, les fichiers suivants doivent être créés :

1. `Pixsaur.app` - L'application principale
2. `Pixsaur_aarch64.app.tar.gz` - Bundle pour Apple Silicon
3. `Pixsaur_aarch64.app.tar.gz.sig` - Signature
4. `Pixsaur_x64.app.tar.gz` - Bundle pour Intel
5. `Pixsaur_x64.app.tar.gz.sig` - Signature
6. `latest.json` - Fichier de metadata

## Debugging

Pour déboguer l'updater sur votre Mac :

1. **Ouvrez la console** : Appuyez sur F12 dans l'application
2. **Vérifiez les logs** : Les messages commencent par `[UPDATER]`
3. **Testez manuellement** :

   ```bash
   # Vérifiez l'URL du manifest
   curl https://github.com/IIIvan37/pixsaur/releases/latest/download/latest.json

   # Vérifiez que le fichier .app.tar.gz existe et est téléchargeable
   curl -L -I https://github.com/IIIvan37/pixsaur/releases/download/vX.X.X/Pixsaur_aarch64.app.tar.gz
   ```

## Erreurs communes

### "Download did not complete successfully"

- Le fichier `.app.tar.gz` n'existe pas ou l'URL est incorrecte
- Vérifiez le fichier `latest.json` sur GitHub

### "Failed to install update"

- Permissions insuffisantes
- L'application n'est pas signée et Gatekeeper bloque l'installation
- Solution temporaire : Aller dans Préférences Système > Sécurité pour autoriser

### "Invalid signature"

- La signature ne correspond pas à la clé publique
- Régénérez les signatures avec `tauri signer sign`

## Prochaines étapes

Pour une expérience optimale en production :

1. **Signer l'application** avec un Apple Developer Certificate
2. **Notariser l'application** auprès d'Apple
3. **Automatiser la génération des artifacts** dans le workflow CI/CD

## Ressources

- [Tauri Updater Documentation](https://tauri.app/v1/guides/distribution/updater)
- [Code Signing for macOS](https://tauri.app/v1/guides/distribution/sign-macos)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
