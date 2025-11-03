# Roadmap - Fonctionnalités avancées Pixsaur

## Vision

Faire de Pixsaur l'outil complet pour les développeurs Amstrad CPC, permettant non seulement la conversion d'images mais aussi la création de projets complets exportables vers du matériel réel ou des émulateurs.

---

## Phase 1: Infrastructure ✅ (Complété)

**Objectif:** Mettre en place l'architecture serverless

- [x] Configuration Netlify Functions
- [x] Structure des endpoints API
- [x] Types TypeScript partagés
- [x] Client API frontend
- [x] Composant UI de base
- [x] Documentation architecture
- [x] Scripts de test

**Durée estimée:** ✅ Fait

---

## Phase 2: RASM Integration 🎯 (Priorité)

**Objectif:** Intégrer RASM pour l'assemblage Z80

### Tasks

- [ ] Compiler RASM en WebAssembly

  - Installer Emscripten
  - Adapter le code source si nécessaire
  - Tester la compilation
  - Optimiser la taille du WASM

- [ ] Créer wrapper TypeScript

  - Interface pour appeler RASM
  - Gestion des fichiers virtuels (FS)
  - Parsing des erreurs d'assemblage
  - Extraction des symboles

- [ ] Intégrer dans `/assemble`

  - Charger le module WASM
  - Gérer les options d'assemblage
  - Retourner binaire + symboles
  - Tests unitaires

- [ ] Documentation
  - Guide d'utilisation
  - Exemples de code Z80
  - Référence des directives supportées

**Durée estimée:** 2-3 semaines

---

## Phase 3: Format DSK 🚧 (En cours)

**Objectif:** Créer des disquettes DSK complètes

### Tasks

- [ ] Implémentation format DSK

  - Parser/Writer format DATA (standard)
  - Parser/Writer format EXTENDED
  - Calcul des checksums
  - Gestion des secteurs

- [ ] Support AMSDOS

  - Headers AMSDOS (128 bytes)
  - Catalogue du disque
  - Allocation des blocs
  - Types de fichiers (binary, ASCII, BASIC)

- [ ] Fonctionnalités avancées

  - Multi-fichiers sur un DSK
  - Fragmentation optimisée
  - Gestion de l'espace libre
  - Validation du disque

- [ ] Tests
  - Tester avec JavaCPC
  - Tester avec WinAPE
  - Tester avec matériel réel (HxC)
  - Tests de corruption

**Durée estimée:** 3-4 semaines

---

## Phase 4: Format SNA 🚧 (En cours)

**Objectif:** Créer des snapshots SNA bootables

### Tasks

- [ ] Implémentation SNA v3

  - Header SNA (256 bytes)
  - État des registres Z80
  - Dump mémoire 64KB
  - État Gate Array
  - État CRTC
  - État PPI

- [ ] Configuration flexible

  - Choix du modèle CPC (464/664/6128)
  - Mode vidéo (0/1/2)
  - Adresses de chargement/exécution
  - ROM/RAM banking

- [ ] Tests
  - Tester avec Arnold
  - Tester avec WinAPE
  - Tester avec RetroVirtualMachine
  - Validation de l'état CPU

**Durée estimée:** 2-3 semaines

---

## Phase 5: Générateur de code 🔮 (Futur)

**Objectif:** Générer automatiquement du code assembleur

### Tasks

- [ ] Générateur pour affichage d'images

  - Code pour décompresser si nécessaire
  - Code pour copier en VRAM
  - Code pour changer de palette
  - Optimisations (unrolled loops)

- [ ] Templates de projets

  - Demo simple
  - Jeu avec sprites
  - Slideshow
  - Menu graphique

- [ ] Loader BASIC intelligent
  - Détection automatique des fichiers
  - Menu de sélection
  - Gestion des erreurs
  - Progress bar

**Durée estimée:** 4-5 semaines

---

## Phase 6: Fonctionnalités avancées 🔮 (Futur)

**Objectif:** Aller au-delà de l'export simple

### Tasks

- [ ] Compression

  - Support RLE (Run-Length Encoding)
  - Support Pack-Ice
  - Support Exomizer
  - Décompresseurs Z80 inclus

- [ ] Animations

  - Export de séquences d'images
  - Génération de player d'animation
  - Optimisation des deltas
  - Support de palettes animées

- [ ] Sprites

  - Extraction de sprites depuis images
  - Sprite atlas / spritesheet
  - Code de gestion de sprites
  - Détection de collision

- [ ] Outils de développement
  - Convertisseur de musique (PT3, etc.)
  - Éditeur de levels
  - Assemblage de projets complets
  - Makefile generator

**Durée estimée:** Long terme (3-6 mois)

---

## Phase 7: Intégration UI complète 🔮 (Futur)

**Objectif:** Interface utilisateur aboutie

### Tasks

- [ ] Panel "Developer Mode"

  - Éditeur de code Z80 intégré
  - Syntax highlighting
  - Autocomplete
  - Error markers

- [ ] Preview avancé

  - Émulateur CPC intégré (WebAssembly)
  - Test en temps réel
  - Debugger basique
  - Breakpoints

- [ ] Project manager

  - Gestion de projets multi-fichiers
  - Versionning (git integration?)
  - Templates de projets
  - Export complet

- [ ] Internationalisation
  - Traduction FR/EN/ES/DE
  - Documentation multilingue
  - Exemples localisés

**Durée estimée:** Long terme (6+ mois)

---

## Métriques de succès

### Phase 2-4 (Court terme)

- [ ] RASM assemblant du code Z80 basique
- [ ] DSK créés lisibles par tous les émulateurs majeurs
- [ ] SNA bootables sur tous les émulateurs
- [ ] Documentation complète et exemples fonctionnels

### Phase 5-6 (Moyen terme)

- [ ] 10+ templates de projets disponibles
- [ ] Compression réduisant la taille des fichiers de 50%+
- [ ] Support des animations fluides (25fps)
- [ ] Community contributions (GitHub)

### Phase 7 (Long terme)

- [ ] Émulateur intégré fonctionnel
- [ ] 100+ utilisateurs actifs par mois
- [ ] Projets complets créés avec Pixsaur
- [ ] Présence dans la communauté CPC

---

## Dépendances techniques

### Obligatoires

- Emscripten (pour compiler RASM en WASM)
- Node.js 18+ (pour Netlify Functions)
- TypeScript 5+ (typage)

### Optionnelles

- Arnold/JavaCPC WASM (pour émulateur intégré)
- Monaco Editor (pour éditeur de code)
- CodeMirror (alternative éditeur)

---

## Ressources nécessaires

### Développement

- ~10-15h/semaine pour phases 2-4
- ~5-10h/semaine pour phases 5-6
- ~20h/semaine pour phase 7

### Documentation

- Guide utilisateur complet
- Tutoriels vidéo
- Exemples de projets
- API reference

### Community

- Discord/Forum pour support
- GitHub Issues/Discussions
- Showcase de projets créés

---

## Questions ouvertes

1. **RASM licensing:** Vérifier la licence pour distribution WASM
2. **Limite taille Netlify Functions:** 50MB max, RASM WASM devrait être <5MB
3. **Compute time:** Netlify Functions limitées à 10s (26s Pro)
4. **Caching:** Stratégie pour cacher RASM WASM côté client?

---

## Contributeurs recherchés

- [ ] Développeur Rust/WASM (compilation RASM)
- [ ] Expert Amstrad CPC (validation formats)
- [ ] Designer UI/UX (amélioration interface)
- [ ] Rédacteur technique (documentation)
- [ ] Testeurs (beta testing)

---

**Date de création:** 2 novembre 2025  
**Dernière mise à jour:** 2 novembre 2025  
**Version:** 1.0
