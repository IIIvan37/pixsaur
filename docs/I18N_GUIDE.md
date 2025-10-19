# Guide d'Internationalisation (i18n)

## Vue d'ensemble

Pixsaur utilise [Lingui](https://lingui.dev/) pour gérer l'internationalisation. Le projet supporte actuellement 4 langues :

- 🇬🇧 **Anglais** (en) - langue par défaut
- 🇫🇷 **Français** (fr)
- 🇪🇸 **Espagnol** (es)
- 🇩🇪 **Allemand** (de)

## État actuel de la traduction

✅ **Tous les composants UI principaux sont traduits** (18 messages) :
- Header et titre de l'application
- Upload d'image (drag & drop)
- Bouton d'export
- Contrôles hardware et mode
- Sélecteur de dithering et intensité
- Ajustements d'image (RGB, luminosité, contraste, saturation, posterisation)
- Bouton de réinitialisation
- Sélecteur de processeur (mode dev)

## Architecture

### Gestion de l'état

La langue sélectionnée est gérée par un atom Jotai qui :
- Stocke la préférence dans `localStorage` (clé: `pixsaur-locale`)
- Détecte automatiquement la langue du navigateur au premier chargement
- Revient à l'anglais si la langue du navigateur n'est pas supportée

**Fichier**: `src/app/store/locale/locale.ts`

### Composants principaux

#### LanguageSelector
Sélecteur de langue dans le header utilisant le composant `Select` de l'UI Radix.

**Fichier**: `src/components/language-selector/language-selector.tsx`

#### I18nProviderWrapper
Provider qui charge dynamiquement les catalogues de traduction selon la langue active.

**Fichier**: `src/app/i18n-provider.tsx`

### Configuration

- **Vite**: Plugin Lingui avec Babel macros activé (`vite.config.ts`)
- **Lingui**: Configuration dans `lingui.config.js`
- **Catalogues**: Fichiers `.po` dans `src/locales/{locale}/messages.po`

## Workflow de traduction

### 1. Ajouter un texte traduisible

Utilisez le composant `Trans` de Lingui :

```tsx
import { Trans } from '@lingui/react/macro'

<p>
  <Trans>Texte à traduire</Trans>
</p>
```

Pour les variables :

```tsx
<Trans>Bienvenue {username}</Trans>
```

### 2. Extraire les messages

```bash
pnpm i18n:extract
```

Cette commande :
- Scanne le code source
- Met à jour les fichiers `.po` dans `src/locales/`
- Affiche les statistiques de traduction

### 3. Traduire les messages

Éditez les fichiers `.po` dans `src/locales/{locale}/messages.po` :

```po
#: src/app/app.tsx:24
msgid "Convertisseur d'images Amstrad CPC"
msgstr "Amstrad CPC Image Converter"
```

### 4. Compiler les catalogues

```bash
pnpm i18n:compile
```

Cette commande :
- Compile les fichiers `.po` en fichiers `.ts` optimisés
- Génère les fichiers dans `src/locales/{locale}/messages.ts`

### 5. Tester

Le serveur de développement recharge automatiquement les traductions compilées.

## Ajouter une nouvelle langue

1. Modifier `lingui.config.js` :
```js
locales: ['en', 'fr', 'es', 'de', 'it'] // Ajout de l'italien
```

2. Mettre à jour `src/app/store/locale/locale.ts` :
```ts
export type SupportedLocale = 'en' | 'fr' | 'es' | 'de' | 'it'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr', 'es', 'de', 'it']

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  // ...
  it: 'Italiano'
}
```

3. Extraire et traduire :
```bash
pnpm i18n:extract
# Éditer src/locales/it/messages.po
pnpm i18n:compile
```

## Bonnes pratiques

### ✅ À faire

- Utiliser `<Trans>` pour tout texte visible par l'utilisateur
- Extraire régulièrement les messages pendant le développement
- Garder les messages simples et concis
- Fournir du contexte aux traducteurs via des commentaires

### ❌ À éviter

- Concaténer des chaînes traduites
- Utiliser des traductions dans la logique métier (uniquement l'UI)
- Oublier de compiler après modification des `.po`

## Commandes utiles

```bash
# Extraire les nouveaux messages
pnpm i18n:extract

# Compiler les catalogues
pnpm i18n:compile

# Workflow complet après ajout de traductions
pnpm i18n:extract && pnpm i18n:compile
```

## Structure des fichiers

```
src/
├── app/
│   ├── i18n-provider.tsx          # Provider i18n
│   └── store/
│       └── locale/
│           ├── locale.ts          # Atom et types
│           └── index.ts
├── components/
│   └── language-selector/
│       ├── language-selector.tsx  # Sélecteur UI
│       └── language-selector.module.css
└── locales/
    ├── en/
    │   ├── messages.po            # Catalogue anglais
    │   └── messages.ts            # Compilé
    ├── fr/
    ├── es/
    └── de/
```

## Ressources

- [Documentation Lingui](https://lingui.dev/)
- [Guide Vite + Lingui](https://lingui.dev/tutorials/setup-vite)
- [API Trans](https://lingui.dev/ref/react#trans)
- [Format PO](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html)
