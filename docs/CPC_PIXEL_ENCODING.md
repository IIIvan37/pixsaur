# Documentation : Encodage des Pixels CPC (Amstrad Color Personal Computer)

## 📖 Vue d'ensemble

L'Amstrad CPC utilise un système d'encodage de pixels complexe qui diffère selon le mode graphique. Cette documentation explique en détail comment les pixels sont encodés en mémoire et comment les reproduire fidèlement.

## 🎨 Modes Graphiques CPC

### Mode 0 - 160×200, 16 couleurs
- **2 pixels par byte**
- **4 bits par pixel** (index de couleur 0-15)
- **Résolution** : 160×200 pixels
- **Couleurs simultanées** : 16 parmi la palette de 27

### Mode 1 - 320×200, 4 couleurs  
- **4 pixels par byte**
- **2 bits par pixel** (index de couleur 0-3)
- **Résolution** : 320×200 pixels
- **Couleurs simultanées** : 4 parmi la palette de 27

### Mode 2 - 640×200, 2 couleurs
- **8 pixels par byte**
- **1 bit par pixel** (index de couleur 0-1)
- **Résolution** : 640×200 pixels
- **Couleurs simultanées** : 2 parmi la palette de 27

## 🔧 Encodage des Pixels

### Mode 0 : Encodage 2 pixels par byte

Le Mode 0 est le plus complexe car il utilise un entrelacement de bits spécifique :

```
Pixel Gauche : Index ABCD (4 bits)
Pixel Droit  : Index EFGH (4 bits)

Byte encodé : 76543210
              AEGCFBDH
```

**Mapping des bits :**
- Bit 7 : A (bit 0 du pixel gauche)
- Bit 6 : E (bit 0 du pixel droit)  
- Bit 5 : G (bit 1 du pixel gauche)
- Bit 4 : C (bit 1 du pixel droit)
- Bit 3 : F (bit 2 du pixel gauche)
- Bit 2 : B (bit 2 du pixel droit)
- Bit 1 : D (bit 3 du pixel gauche)
- Bit 0 : H (bit 3 du pixel droit)

**Exemple concret :**
```typescript
// Pixels : gauche=13 (1101), droit=6 (0110)
// 
// Gauche 13 = 1101 : A=1, G=1, F=0, D=1
// Droit   6 = 0110 : E=0, C=1, B=1, H=0
//
// Byte = AEGCFBDH = 10110110 = 0x9E
```

### Mode 1 : Encodage 4 pixels par byte

```
4 Pixels : P0, P1, P2, P3 (2 bits chacun)

Byte encodé : 76543210
              P0₀P1₀P2₀P3₀P0₁P1₁P2₁P3₁
```

**Mapping des bits :**
- Bit 7 : P0 bit 0
- Bit 6 : P1 bit 0  
- Bit 5 : P2 bit 0
- Bit 4 : P3 bit 0
- Bit 3 : P0 bit 1
- Bit 2 : P1 bit 1
- Bit 1 : P2 bit 1
- Bit 0 : P3 bit 1

### Mode 2 : Encodage 8 pixels par byte

```
8 Pixels : P0, P1, P2, P3, P4, P5, P6, P7 (1 bit chacun)

Byte encodé : 76543210
              P0P1P2P3P4P5P6P7
```

Simple mapping séquentiel de gauche à droite.

## 🎯 Palette de Couleurs CPC

### Palette Hardware (27 couleurs)

L'Amstrad CPC Classic possède 27 couleurs prédéfinies avec des valeurs RGB spécifiques :

```typescript
// Chaque composante RGB ne peut être que : 0, 128, ou 255
const cpcColors = [
  { index: 0,  name: 'Black',         rgb: [0,   0,   0  ] },
  { index: 1,  name: 'Blue',          rgb: [0,   0,   128] },
  { index: 2,  name: 'Bright Blue',   rgb: [0,   0,   255] },
  { index: 3,  name: 'Red',           rgb: [128, 0,   0  ] },
  { index: 4,  name: 'Magenta',       rgb: [128, 0,   128] },
  { index: 5,  name: 'Mauve',         rgb: [128, 0,   255] },
  { index: 6,  name: 'Bright Red',    rgb: [255, 0,   0  ] },
  { index: 7,  name: 'Purple',        rgb: [255, 0,   128] },
  { index: 8,  name: 'Bright Magenta',rgb: [255, 0,   255] },
  { index: 9,  name: 'Green',         rgb: [0,   128, 0  ] },
  { index: 10, name: 'Cyan',          rgb: [0,   128, 128] },
  // ... etc (27 couleurs total)
]
```

### ⚠️ Contrainte Critique

**Tous les outils de conversion doivent respecter cette contrainte :**
- Les valeurs RGB doivent être **exactement** 0, 128, ou 255
- Toute autre valeur causera des erreurs d'encodage

## 🐛 Problème Résolu : Bits 1-2 des Indices

### Diagnostic du Problème

Lors du développement de Pixsaur, nous avons découvert que les exports ASM ne correspondaient pas visuellement aux exports PNG. L'analyse a révélé :

1. **Pattern XOR systématique** : 0x14 (00010100) entre les données Pixsaur et Img2CPC
2. **Bits affectés** : positions 2 et 4 dans les bytes encodés
3. **Cause racine** : échange des bits 1 et 2 des indices de couleur

### Solution Implémentée

```typescript
/**
 * Corrige les indices de couleur pour correspondre au format CPC standard
 * Échange les bits 1 et 2 de chaque index de couleur
 */
export function correctColorIndicesForCPC(indices: Uint8Array): Uint8Array {
  const corrected = new Uint8Array(indices.length)
  
  for (let i = 0; i < indices.length; i++) {
    const originalIndex = indices[i]
    
    // Extraire les bits individuels
    const b0 = (originalIndex >> 0) & 1  // bit 0
    const b1 = (originalIndex >> 1) & 1  // bit 1  
    const b2 = (originalIndex >> 2) & 1  // bit 2
    const b3 = (originalIndex >> 3) & 1  // bit 3
    
    // Reconstruire l'index avec bits 1 et 2 échangés
    const correctedIndex = (b0 << 0) | (b2 << 1) | (b1 << 2) | (b3 << 3)
    
    corrected[i] = correctedIndex
  }
  
  return corrected
}
```

### Table de Transformation

```
Pixsaur Index -> CPC Index Correct
 0 (0000) ->  0 (0000)  ✓ Pas de changement
 1 (0001) ->  1 (0001)  ✓ Pas de changement
 2 (0010) ->  4 (0100)  ← Bit 1 devient bit 2
 3 (0011) ->  5 (0101)  ← Bit 1 devient bit 2
 4 (0100) ->  2 (0010)  ← Bit 2 devient bit 1
 5 (0101) ->  3 (0011)  ← Bits 1&2 échangés
 6 (0110) ->  6 (0110)  ✓ Pas de changement
 7 (0111) ->  7 (0111)  ✓ Pas de changement
 8 (1000) ->  8 (1000)  ✓ Pas de changement
 9 (1001) ->  9 (1001)  ✓ Pas de changement
10 (1010) -> 12 (1100)  ← Bit 1 devient bit 2
11 (1011) -> 13 (1101)  ← Bit 1 devient bit 2
12 (1100) -> 10 (1010)  ← Bit 2 devient bit 1
13 (1101) -> 11 (1011)  ← Bits 1&2 échangés
14 (1110) -> 14 (1110)  ✓ Pas de changement
15 (1111) -> 15 (1111)  ✓ Pas de changement
```

## 📁 Format de Fichier SCR

### Structure du fichier .SCR

Un fichier SCR standard fait **16384 bytes** (0x4000) :

```
Offset        Taille    Description
0x0000-0x3FFF 16384     Données d'écran (pixels encodés)
```

### Structure étendue avec palette

Certains fichiers incluent des données de palette supplémentaires :

```
Offset        Taille    Description
0x0000-0x3FFF 16384     Données d'écran
0x4000        1         Index couleur bordure (firmware)
0x4001-0x4010 16        Palette firmware (indices 0-15)
0x4011-0x4020 16        Palette hardware (valeurs Gate Array)
```

## 💻 Implémentation de Référence

### Fonction d'encodage Mode 0

```typescript
export function encodeByte(
  indexBuf: Uint8Array,
  x: number,
  y: number,
  mode: 0 | 1 | 2,
  width: number
): number {
  const px = y * width + x
  let byte = 0

  switch (mode) {
    case 0: {
      const left = indexBuf[px] & 0x0f // pixel gauche
      const right = indexBuf[px + 1] & 0x0f // pixel droit

      byte =
        (((left >> 0) & 1) << 7) |   // A -> bit 7
        (((right >> 0) & 1) << 6) |  // E -> bit 6
        (((left >> 1) & 1) << 5) |   // G -> bit 5
        (((right >> 1) & 1) << 4) |  // C -> bit 4
        (((left >> 2) & 1) << 3) |   // F -> bit 3
        (((right >> 2) & 1) << 2) |  // B -> bit 2
        (((left >> 3) & 1) << 1) |   // D -> bit 1
        (((right >> 3) & 1) << 0)    // H -> bit 0
      break
    }
    // ... autres modes
  }

  return byte
}
```

### Calcul d'adresse mémoire CPC

```typescript
function computeCPCAddress(x: number, y: number): number {
  const row = y & 0b00000111 // y % 8 (ligne dans le caractère)
  const block = (y >> 3) * 80 // ligne logique * 80 colonnes
  return row * 2048 + block + x // position finale en mémoire
}
```

## 🧪 Tests et Validation

### Test d'encodage Mode 0

```typescript
it('Mode 0: pixels 13 (1101) + 6 (0110) → 0x9E', () => {
  const indexBuf = new Uint8Array([13, 6])
  const result = encodeByte(indexBuf, 0, 0, 0, 2)
  expect(result).toBe(0x9e) // 10011110
})
```

### Validation avec machine réelle

Pour valider la conformité :
1. **Exporter** une image depuis votre outil
2. **Charger** le fichier .SCR sur un CPC réel ou émulateur
3. **Comparer** visuellement avec l'image source
4. **Tester** différents modes et palettes

## ⚡ Performance et Optimisations

### Cache de conversion RGB→Index

```typescript
const paletteMap = new Map<string, number>()
palette.forEach(([r, g, b], idx) => {
  paletteMap.set(`${r},${g},${b}`, idx)
})
```

### Traitement par chunks

Pour de gros volumes de données, traiter par blocs de 8Ko pour optimiser la mémoire.

## 🔍 Débuggage et Diagnostic

### Outils d'analyse recommandés

1. **Comparaison hexadécimale** des fichiers .SCR
2. **Analyse bit-à-bit** des différences
3. **Décodage des pixels** pour vérification visuelle
4. **Validation croisée** avec des outils de référence (Img2CPC)

### Patterns d'erreur courants

- **XOR systématique** : indices de couleur incorrects
- **Pixels inversés** : ordre gauche/droite échangé
- **Couleurs fausses** : palette non quantifiée correctement
- **Artefacts géométriques** : calcul d'adresse mémoire erroné

## 📚 Références

- **Documentation officielle** Amstrad CPC
- **Gate Array** documentation technique
- **CRTC 6845** spécifications vidéo
- **Img2CPC** - outil de référence pour la conversion

---

**Note :** Cette documentation est basée sur l'expérience de debugging réel entre Pixsaur et Img2CPC, avec validation sur machine CPC authentique.