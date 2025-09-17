# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Pixsaur - Image Processing & Palette Quantization

Pixsaur est une application web moderne de traitement d'images avec quantification de palette, construite avec React, TypeScript et une architecture adaptateur flexible pour supporter CPU et GPU.

## 🚀 Démarrage Rapide

```bash
# Installation
pnpm install

# Développement
pnpm dev

# Build
pnpm build

# Tests
pnpm test
```

## 🎯 Fonctionnalités

- **Traitement d'images** : Ajustements de luminosité, contraste, saturation
- **Quantification de palette** : Conversion vers palettes couleur spécifiques
- **Architecture adaptateur** : Support CPU/GPU avec fallback intelligent
- **Performance optimisée** : Monitoring et benchmarks intégrés

## 📚 Documentation

→ **[Documentation complète dans `/docs`](./docs/)**

- **[Guide de Développement](./docs/DEVELOPMENT_GUIDE.md)** : Documentation principale et référence
- **[Index de Documentation](./docs/DOCUMENTATION_INDEX.md)** : Navigation et organisation

## 🔧 Stack Technique

- **React 19** avec TypeScript
- **Vite** pour le build et le dev server
- **Jotai** pour la gestion d'état
- **ReGL** pour l'accélération GPU future
- **Radix UI** pour les composants UI
- **Vitest** pour les tests

## 🎮 Architecture

```
CPU Processor (Stable) ←→ ReGL Processor (Future GPU + Fallback CPU)
                    ↓
             Factory Pattern + Cache
                    ↓
              Interface Unifiée
```

## 📊 Performance

### Benchmarks CPU Actuels
- Ajustements : ~37ms
- Quantification : ~408-431ms
- Pipeline total : ~1263ms (image 766x800px)

### Objectifs GPU
- Minimum : 2x plus rapide
- Recommandé : 4x plus rapide
- Excellent : 6x plus rapide

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

Ce projet est sous licence MIT.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
