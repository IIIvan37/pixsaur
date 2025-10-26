# Nouvelles fonctionnalités - Dimensions personnalisées

## 🎯 Dimensions personnalisées pour vos conversions CPC

Vous pouvez maintenant définir précisément les dimensions de vos images converties, au-delà des formats Standard et Overscan.

---

## ✨ Nouveautés

### 📐 **Dimensions sur mesure**

**Nouvelle section "Dimensions" avec 3 options :**
- **Standard** : dimensions classiques (160×200, 320×200, ou 640×200 selon le mode pixel)
- **Overscan** : plein écran avec bordures (192×280, 384×280, ou 768×280)
- **Custom** : définissez vos propres dimensions avec des curseurs intelligents

**Quand vous sélectionnez "Custom" :**
- 2 curseurs apparaissent pour ajuster largeur et hauteur
- Les limites maximum s'adaptent automatiquement pour respecter la limite de 64 Ko de mémoire CPC
- Vous voyez en temps réel la mémoire utilisée (ex: "32.50 Ko / 64 Ko")
- Les dimensions sont toujours compatibles avec le mode CPC choisi

### 🖱️ **Aperçu interactif**

**Cliquez sur l'image de prévisualisation** pour ouvrir une version PNG avec les proportions CPC correctes dans un nouvel onglet.

**Pourquoi ?** Les pixels CPC ne sont pas carrés :
- **Mode 0** : pixels 2× plus larges que hauts
- **Mode 2** : pixels 2× plus hauts que larges  
- **Mode 1** : pixels carrés

Le PNG exporté corrige ces proportions pour un rendu fidèle.

### �️ **Nouveau mode de redimensionnement : Origin**

**Deux modes de redimensionnement disponibles :**

**Mode Auto (par défaut) :**
- Redimensionne automatiquement votre image pour remplir les dimensions cibles
- Conserve les proportions et centre l'image
- Parfait pour la plupart des usages

**Mode Origin (nouveau) :**
- Colle l'image en haut à gauche, sans redimensionnement automatique
- Idéal pour les sprites, tiles, ou quand vous voulez un contrôle pixel-perfect
- Si l'image est plus petite que les dimensions cibles, le reste est rempli avec la couleur la plus sombre de votre palette
- Si l'image est plus grande, elle est recadrée à partir du coin supérieur gauche

**Exemple d'usage :**
- Vous avez un sprite de 32×32 pixels
- Vous choisissez Mode 0 Custom avec 160×200
- En mode Origin : le sprite est placé en haut à gauche, le reste (128×168 pixels) est rempli avec du noir
- Parfait pour créer des écrans avec plusieurs sprites !

### �📦 **Exports adaptés**

**Format SCR :**
- Désactivé automatiquement pour les dimensions personnalisées
- Un message vous explique pourquoi : "Le format SCR nécessite des dimensions standard"

**Format Linear (binaire) :**
- **Découpage automatique en chunks** : Si votre image dépasse 16 Ko, elle est automatiquement divisée en plusieurs fichiers
- Nommage clair : `image_linear_chunk_0001.bin`, `_0002.bin`, etc.
- Chaque chunk fait maximum 16 Ko (parfait pour charger en mémoire par morceaux)
- **Pourquoi ?** Facilite le chargement d'images volumineuses en plusieurs étapes sur CPC

**Format PNG corrigé :**
- Nouveau format d'export avec les proportions de pixels CPC appliquées
- Parfait pour visualiser le rendu final sur écran moderne

---

## 🎨 Séparation Mode pixel / Dimensions

L'interface a été réorganisée pour plus de clarté :

**Avant :**
- Un seul choix : "Mode 0", "Mode 1", "Mode 2", "Overscan Mode 0", etc.
- Difficile de changer juste les dimensions sans changer le mode pixel

**Maintenant :**
- **Section "Mode pixel"** : choisissez Mode 0, 1 ou 2 (type de pixels)
- **Section "Dimensions"** : choisissez Standard, Overscan ou Custom
- Les deux choix sont indépendants et se combinent automatiquement

### 🧠 Héritage intelligent

Quand vous changez de mode, les dimensions s'adaptent intelligemment :

**Exemple 1 :** Mode 0 Standard (160×200) → Mode 1
- Les dimensions deviennent automatiquement 320×200 (Standard pour Mode 1)

**Exemple 2 :** Mode 0 Standard → Custom → Mode 1
- Le mode Custom conserve les dimensions personnalisées
- Elles restent valides si elles respectent les contraintes du Mode 1

---

## 🌍 Traductions complètes

Toutes les nouvelles fonctionnalités sont traduites en :
- 🇫🇷 Français
- 🇬🇧 English  
- 🇩🇪 Deutsch
- 🇪🇸 Español

---

## 📊 Avant / Après

### ❌ Avant

- Seulement 2 tailles disponibles par mode (Standard et Overscan)
- Impossible de créer une image de 180×150 pixels
- Pas de feedback sur la mémoire utilisée
- Format SCR toujours disponible même si incompatible

### ✅ Maintenant

- Dimensions totalement libres (dans la limite des 64 Ko)
- Curseurs avec limites intelligentes qui s'adaptent
- Affichage temps réel de la mémoire utilisée
- Export adapté selon vos choix :
  - SCR désactivé si besoin
  - **Découpage automatique en chunks de 16 Ko** pour les grandes images
  - PNG corrigé avec proportions CPC
- Clic sur preview pour voir le rendu final avec proportions correctes
- Interface claire avec séparation mode pixel / dimensions
- **Mode Origin** pour placement pixel-perfect sans redimensionnement

---

## 🛠️ Utilisation

1. **Choisissez votre mode pixel** : Mode 0, 1 ou 2
2. **Choisissez vos dimensions** :
   - Standard : rapide, optimisé
   - Overscan : plein écran
   - Custom : contrôle total
3. **Si Custom** : ajustez les curseurs Largeur et Hauteur
   - Surveillez la mémoire (max 64 Ko)
   - Les curseurs s'arrêtent automatiquement à la limite
4. **Choisissez le mode de redimensionnement** :
   - **Auto** : redimensionne et centre automatiquement (recommandé)
   - **Origin** : placement pixel-perfect en haut à gauche (sprites, tiles)
5. **Exportez** : tous les formats s'adaptent automatiquement
   - Les grandes images sont découpées en chunks de 16 Ko
   - Le PNG corrigé vous montre le rendu final exact

---

**Note :** Cette mise à jour améliore votre contrôle créatif tout en garantissant que vos images restent compatibles avec le matériel Amstrad CPC.
