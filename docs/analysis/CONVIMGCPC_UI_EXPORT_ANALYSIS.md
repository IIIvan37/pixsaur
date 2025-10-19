# ConvImgCpc - Analyse UI et Exports
*Document complémentaire à CONVIMGCPC_ANALYSIS.md*

**Date**: 19 octobre 2025  
**Objectif**: Analyser en détail l'interface utilisateur et le système d'export de ConvImgCpc pour identifier des améliorations pour Pixsaur

---

## 1. Architecture de l'Interface Utilisateur

### 1.1 Structure Générale

ConvImgCpc utilise une interface Windows Forms (C#) avec plusieurs fenêtres modales et panels :

```
Main.cs (Fenêtre principale)
├── ImageSource (imgSrc) - Image source
├── ImageCpc (imgCpc) - Preview CPC
├── Animation (anim) - Gestionnaire d'animations
├── Informations (info) - Panel d'informations
└── ParamInterne - Paramètres internes
```

#### Fenêtres secondaires :
- **EditSprites** : Éditeur de sprites hardware (16x16)
- **EditSplit** : Éditeur de split-screen (rasters)
- **EditTrameAscii** : Éditeur de matrices de dithering custom
- **GenPalette** : Générateur de palettes avec dégradés
- **RasterTablePlus** : Gestionnaire de tables de rasters CPC Plus
- **Capture** : Outil de capture de zones d'écran
- **SaveMedia** : Dialog de configuration d'export
- **SaveAnim** : Dialog d'export d'animations

### 1.2 Contrôles de l'Interface Principale

#### Panneau Source
```csharp
// Sélection du mode de redimensionnement
radioFit        // Adapter à la taille
radioKeepLarger // Conserver proportions (plus grand)
radioKeepSmaller// Conserver proportions (plus petit)
radioOrigin     // Taille originale
radioUserSize   // Taille personnalisée

// Dimensions personnalisées
numSizeX, numSizeY  // Taille cible
numPosX, numPosY    // Position de découpe
bpXDiv2, bpXMul2    // Boutons ×2 / ÷2 pour X
bpYDiv2, bpYMul2    // Boutons ×2 / ÷2 pour Y
```

#### Panneau Réglages d'Image
```csharp
// Réglages de luminosité/contraste/saturation
lumi.Value      // TrackBar luminosité (0-200%)
sat.Value       // TrackBar saturation (0-200%)
contrast.Value  // TrackBar contraste (0-200%)
nb.Checked      // Mode noir & blanc
chkGauss        // Filtre gaussien

// Réglages de couleurs individuelles
red.Value       // TrackBar rouge (0-200%)
green.Value     // TrackBar vert (0-200%)
blue.Value      // TrackBar bleu (0-200%)
```

#### Panneau Configuration CPC
```csharp
// Mode CPC
modePlus.Checked    // CPC/CPC+ toggle
mode.SelectedIndex  // Mode 0/1/2/3
nbCols.Value        // Largeur en colonnes (1-96)
nbLignes.Value      // Hauteur en lignes (1-272)
bpStandard          // Preset 80×200
bpOverscan          // Preset 96×272

// Bits de couleur (quantification)
rb24bits, rb12bits, rb9bits, rb6bits
```

#### Panneau Dithering
```csharp
methode.SelectedIndex    // Sélection algorithme
// Liste : Aucun, Floyd-Steinberg, Floyd-Steinberg 2×2,
//         Bayer 2×2, 4×4, 8×8, Ordered 2×2, 4×4, 8×8,
//         ZigZag, Clustered 4×4, Lines Horiz/Vert

pctTrame.Value          // Intensité du tramage (0-100%)
chkDiffErr.Checked      // Diffusion d'erreur activée
chkLissage.Checked      // Lissage horizontal
trackModeX.Value        // Mode de tramage horizontal
```

#### Panneau Palette
```csharp
// Gestion de palette (16 slots)
lblColors[i]        // Label couleur cliquable
lockColors[i]       // Checkbox verrouillage couleur
disableColors[i]    // Checkbox désactivation couleur
lblUsedColors[i]    // Indicateur d'utilisation

// Réduction de palette
chkNewReduc         // Nouvelle méthode de réduction
reducPal1/2/3/4     // Checkboxes modes de réduction
sortPal.Checked     // Tri automatique de palette
newMethode.Checked  // Nouvelle méthode de quantification
```

### 1.3 Éditeurs Spécialisés

#### EditSprites - Éditeur de Sprites Hardware
```csharp
// Interface à 3 panels
pictEditSprite      // Zone d'édition du sprite 16×16
pictAllSprites      // Vue de tous les sprites (banque)
pictTest            // Preview du sprite en jeu

// Outils
comboBanque         // Sélection banque (256 sprites/banque)
lblColors[16]       // Palette de 15 couleurs + transparent
chkWithPal          // Exporter palette avec sprites

// Export
Filter = ".spr (binaire) | .asm (data) | .asm (compacté) | .asm (full)"
```

#### EditSplit - Éditeur Split-Screen
```csharp
// Gestion des lignes de split
numLigne            // Numéro de ligne (0-271)
numPenMode          // Couleur/Mode pour cette ligne
retard              // Délai d'attente (timing)
colors[i]           // 16 sélecteurs de couleur
chkChangeMode       // Changement de mode vidéo
```

#### EditTrameAscii - Matrices de Dithering Custom
```csharp
pictEditMatrice     // Éditeur visuel 8×8 de la matrice
lblPen0/1/2/3       // Affichage des couleurs utilisées

// Valeurs ASCII → niveaux de gris
// Permet de créer des matrices custom pour tramage
```

### 1.4 Système de Palettes

#### Verrouillage et Désactivation
```csharp
// lockState[] peut avoir 3 états par couleur:
// 0 = libre
// 1 = verrouillée (ne change pas)
// 2 = désactivée (non utilisée)

// Algorithme de gestion
public void SetLockPalette() {
    for (int i = 0; i < 16; i++) {
        lockState[i] = lockColors[i].Checked ? 1 : 0;
        if (disableColors[i].Checked)
            lockState[i] = 2;
    }
}
```

**💡 Opportunité Pixsaur** : Nous avons déjà un système de verrouillage basique, mais pas de désactivation de couleurs. À implémenter !

#### Générateur de Palette (GenPalette)
```csharp
// Dégradés linéaires RGB
trkStartR/V/B       // Couleur de départ (0-255)
trkEndR/V/B         // Couleur d'arrivée (0-255)
numNbColors         // Nombre de couleurs du dégradé (2-16)

// Génère automatiquement un gradient et l'applique
```

---

## 2. Système d'Export Détaillé

### 2.1 Formats d'Export Disponibles

ConvImgCpc offre **17+ formats d'export** différents via le menu Save :

```csharp
SaveFileDialog dlg = new SaveFileDialog {
    Filter = 
        "1.  CPC Screen (.scr)|*.scr|" +           // Binaire brut
        "2.  Bitmap (.png)|*.png|" +                // PNG pour preview
        "3.  Soft Sprite (.asm)|*.asm|" +           // Sprite logiciel ASM
        "4.  Soft Sprite Compacté (.asm)|*.asm|" +  // Sprite compacté
        "5.  Image Compactée (.cmp)|*.cmp|" +       // Binaire compacté
        "6.  Image ASM (.asm)|*.asm|" +             // ASM avec code
        "7.  CPC Screen DSK (.dsk)|*.dsk|" +        // Injection dans DSK
        "8.  Image Compactée DSK (.dsk)|*.dsk|" +   // DSK compacté
        "9.  Animation DeltaPack (.asm)|*.asm|" +   // Animation delta
        "10. IMP Mode Draw (.imp)|*.imp|" +         // Format IMP-Draw
        "11. Tiles 8×16 (.imp)|*.imp|" +            // Tileset 8×16
        "12. Tiles 16×16 (.imp)|*.imp|" +           // Tileset 16×16
        "13. Tiles 32×32 (.imp)|*.imp|" +           // Tileset 32×32
        "14. Paramètres (.xml)|*.xml|" +            // Config export
        "15. Palette (.pal)|*.pal|" +               // Palette seule
        "16. Palette CPC+ (.kit)|*.kit|" +          // Palette 4096 colors
        "17. Mode EGX (.scr)|*.scr" +               // Double-écran EGX
        "18. Bump (.asm)|*.asm|" +                  // Effet Bump mapping
        "19. DiffAnim (.asm)|*.asm"                 // Animation différentielle
};
```

### 2.2 Analyse des Formats Clés

#### 2.2.1 Format SCR (Standard CPC Screen)
```csharp
public static int SauveScr(string fileName, BitmapCpc bitmapCpc, 
                          Main main, PackMethode compact, 
                          OutputFormat format, Param param) {
    // Création de l'en-tête AMSDOS
    CpcAmsdos entete = Cpc.CreeEntete(fileName, startAdr, lg, exec);
    
    switch(format) {
        case Binary:
            fp.Write(Cpc.AmsdosToByte(entete));  // 128 bytes header
            fp.Write(bitmapCpc.bmpCpc, 0, lg);   // Pixel data
            break;
            
        case Assembler:
            SaveImgAsm(main, compact, param, fileName, version, bufPack, lg);
            break;
            
        case DSK:
            main.dsk.AddFileToDsk(fileName, fic);
            break;
    }
}
```

**Structure fichier SCR** :
```
Offset  Size    Description
------  ----    -----------
0x00    128     En-tête AMSDOS (metadata)
0x80    16384   Pixels (Mode 0: 16K, Mode 1: 16K, Mode 2: 16K)
        +32     Palette optionnelle (16 couleurs × 2 bytes)
```

#### 2.2.2 Format ASM (Assembleur)
```csharp
static private void SaveImgAsm(Main main, PackMethode compact, 
                              Param param, string fileName) {
    StreamWriter sw = SaveAsm.OpenAsm(fileName, version, true);
    
    // Labels configurables
    string labelMedia = dlgSave.LabelMedia;      // "ImageCmp"
    string labelPalette = dlgSave.LabelPal;      // "Palette"
    
    if (param.withCode) {
        // Génération du code de décompression
        sw.WriteLine("    ORG    #A500");
        GenereDepack(sw, pkMethode, jumpLabel);
        GenereAfficheStd(sw, overscan, pkMethode, labelMedia, labelPalette);
    }
    
    // Données
    sw.WriteLine(labelMedia);
    GenereDatas(sw, bufPack, lg, 16);  // 16 bytes par ligne
    
    if (param.withPalette) {
        sw.WriteLine(labelPalette);
        GenerePalette(sw, param, true, param.withCode, labelPalette);
    }
}
```

**Exemple de sortie ASM** :
```asm
    ORG    #A500
    Nolist
    
    ; Code de décompression ZX0 V2
Depack:
    ; ... (routine de décompression)
    
    ; Affichage standard
AfficheImage:
    DI
    LD    HL,Palette
    CALL  InitPalette
    LD    HL,ImageCmp
    LD    DE,#C000
    CALL  Depack
    EI
    RET

ImageCmp:
    DB    #ED,#B0,#12,#34,#56,#78,#9A,#BC,#DE,#F0,#11,#22,#33,#44,#55,#66
    ; ... (données compactées)

Palette:
    DB    #54,#44,#55,#5C,#58,#5D,#4C,#56,#46,#57,#5E,#40,#5F,#4D,#47,#4F
```

#### 2.2.3 Format KIT (Palette CPC Plus)
```csharp
public void SavePaletteKit(string fileName, bool isImage = false) {
    CpcAmsdos entete = Cpc.CreeEntete(fileName, -32768, 30, 0);
    fp.Write(Cpc.AmsdosToByte(entete));
    
    for (int i = isImage ? 0 : 1; i < 16; i++) {
        int kit = isImage ? Cpc.Palette[i] : Cpc.paletteSprite[i];
        
        // Format 12-bit RGB (0GRB) → 2 bytes little-endian
        byte c1 = (byte)(((kit & 0x0F) << 4) + ((kit & 0xF0) >> 4));
        byte c2 = (byte)(kit >> 8);
        
        fp.Write(c1);  // RB nibbles
        fp.Write(c2);  // G nibble
    }
}
```

**Format KIT** :
```
Offset  Size    Description
------  ----    -----------
0x00    128     En-tête AMSDOS
0x80    30      15 couleurs × 2 bytes (format 0GRB, 4 bits/composante)
```

#### 2.2.4 Dialog SaveMedia - Configuration Export
```csharp
public partial class SaveMedia : Form {
    public string LabelMedia { get; }      // "ImageCmp"
    public string LabelPal { get; }        // "Palette"
    public string LabelPtr { get; }        // "ImagePtr" (pour sprites)
    public bool ZeroPtr { get; }           // Ajouter ptr NULL final
    
    // Interface
    chkLabelMedia       // Activer label données
    txbLabelMedia       // Nom du label
    chkLabelPalette     // Activer label palette
    txbLabelPalette     // Nom du label palette
    chkLabelPtr         // Activer table de pointeurs (sprites)
    txbLabelPtr         // Nom du label pointeurs
    chkZeroPtr          // Terminer table avec 0
}
```

**💡 Opportunité Pixsaur** : Dialog de configuration d'export très flexible. À adapter pour nos exports TypeScript/JSON.

### 2.3 Compression et Packing

#### Méthodes de Compression Supportées
```csharp
public enum PackMethode { 
    None = 0,      // Pas de compression
    Standard,      // RLE basique
    ZX0,           // ZX0 original
    ZX0_V2,        // ZX0 version 2 (meilleur ratio)
    ZX1,           // ZX1 (plus rapide)
    ZX0Ovs         // ZX0 optimisé overscan
}
```

#### Génération des Routines de Décompression
```csharp
static private void GenereDepack(StreamWriter sw, PackMethode pkMethode, 
                                string jumpLabel = null) {
    switch(pkMethode) {
        case ZX0_V2:
            GenereDZX0_V2(sw, jumpLabel);
            break;
        case ZX1:
            GenereDZX1(sw, jumpLabel);
            break;
        // ...
    }
}

static private void GenereDZX0_V2(StreamWriter sw, string jumpLabel) {
    sw.WriteLine("Depack:");
    sw.WriteLine("    LD      BC,#FFFF");
    sw.WriteLine("    PUSH    BC");
    sw.WriteLine("    INC     BC");
    sw.WriteLine("    LD      A,#80");
    // ... (code Z80 complet de décompression)
}
```

**Code généré inclus** : Les routines de décompression sont intégrées directement dans le fichier ASM exporté, prêtes à l'emploi.

### 2.4 Export d'Animations

#### DeltaPack - Animation par Différence
```csharp
public void SauveDeltaPack(string fileName, string version, 
                          bool reboucle, PackMethode pkMethode) {
    // Analyse des différences frame-à-frame
    for (int i = 0; i < nbImages; i++) {
        main.SelectImage(i, true);
        byte[] src = bitmapCpc.bmpCpc;
        
        if (i == 0)
            Buffer.BlockCopy(src, 0, bufOut, 0, src.Length);
        else {
            // Calcul des deltas
            CalculateDelta(src, bufOut, deltaBuffer);
            int lg = Compact(deltaBuffer, bufPack, pkMethode);
            SaveFrame(sw, bufPack, lg);
        }
    }
}
```

**Format DeltaPack** :
```asm
Frame0:     ; Image complète
    DB    ...
Frame1:     ; Deltas uniquement
    DW    nbChanges
    DB    offset1_hi, offset1_lo, value1
    DB    offset2_hi, offset2_lo, value2
    ; ...
```

#### DiffImage - Animation Différentielle
```csharp
public void SauveDiffImage(string fileName, string version, 
                          bool reboucle, PackMethode pkMethode) {
    for (int i = 0; i < nbImages; i++) {
        if (i == 0)
            SaveFullFrame(sw, bufOut);
        else {
            // Détection des blocs modifiés (16 bytes/bloc)
            List<int> modifiedBlocks = DetectModifiedBlocks(src, bufOut);
            
            // Export uniquement des blocs modifiés
            sw.WriteLine($"Frame{i}:");
            sw.WriteLine($"    DB    {modifiedBlocks.Count}");
            foreach(int block in modifiedBlocks) {
                sw.WriteLine($"    DW    #{block:X4}");
                SaveBlock(sw, src, block);
            }
        }
    }
}
```

### 2.5 Export de Tiles

#### Système de Tileset
```csharp
public void SauveTiles(string fileName, int tailleX, int tailleY, Param param) {
    Dictionary<int, byte[]> uniqueTiles = new Dictionary<int, byte[]>();
    int[][] tileMap = new int[Cpc.TailleX / tailleX][Cpc.TailleY / tailleY];
    
    // Extraction et déduplication des tiles
    for (int y = 0; y < Cpc.TailleY; y += tailleY) {
        for (int x = 0; x < Cpc.TailleX; x += tailleX) {
            byte[] tile = ExtractTile(x, y, tailleX, tailleY);
            int hash = CalculateHash(tile);
            
            if (!uniqueTiles.ContainsKey(hash)) {
                uniqueTiles.Add(hash, tile);
                tileMap[x/tailleX][y/tailleY] = uniqueTiles.Count - 1;
            } else {
                tileMap[x/tailleX][y/tailleY] = 
                    uniqueTiles.Keys.ToList().IndexOf(hash);
            }
        }
    }
    
    // Export
    SaveTileData(fileName + ".DAT", uniqueTiles);
    SaveTileMap(fileName + ".MAP", tileMap);
    SaveTilePalette(fileName + ".PAL", param);
}
```

**Formats de fichiers Tiles** :
```
.DAT : Données des tiles uniques (binaire)
.MAP : Index des tiles (tilemap)
.TIL : Alternative avec en-tête AMSDOS
.PAL/.KIT : Palette associée
```

---

## 3. Comparaison avec Pixsaur

### 3.1 Ce que Pixsaur a Déjà

| Fonctionnalité | Pixsaur | ConvImgCpc |
|----------------|---------|------------|
| **Export SCR** | ✅ | ✅ |
| **Export PNG** | ✅ | ✅ |
| **Export DSK** | ✅ | ✅ |
| **CPC Plus (4096 couleurs)** | ✅ | ✅ |
| **Brightness/Contrast/Saturation** | ✅ | ✅ |
| **Verrouillage couleurs** | ✅ | ✅ |
| **GPU Acceleration** | ✅ (ReGL) | ❌ |
| **Interface moderne** | ✅ (React) | ❌ (WinForms) |
| **Multi-langue** | ✅ (i18n) | ✅ |

### 3.2 Ce qui Manque à Pixsaur

#### Exports Absents
| Format | ConvImgCpc | Pixsaur | Priorité |
|--------|------------|---------|----------|
| **ASM avec code** | ✅ | ❌ | 🔴 HIGH |
| **Palette .KIT export** | ✅ | ✅ | ✅ |
| **Tiles/Tilemap** | ✅ | ❌ | 🟡 MEDIUM |
| **Animations DeltaPack** | ✅ | ❌ | 🟢 LOW |
| **IMP-Draw format** | ✅ | ❌ | 🟢 LOW |
| **Sprites hardware** | ✅ | ❌ | 🟢 LOW |

#### Fonctionnalités UI Absentes
| Fonctionnalité | ConvImgCpc | Pixsaur | Impact |
|----------------|------------|---------|--------|
| **Désactivation couleurs** | ✅ | ❌ | 🔴 HIGH |
| **Labels ASM configurables** | ✅ | ❌ | 🟡 MEDIUM |
| **Générateur de palette** | ✅ | ❌ | 🟡 MEDIUM |
| **Éditeur split-screen** | ✅ | ❌ | 🟢 LOW |
| **Matrice dithering custom** | ✅ | ❌ | 🟢 LOW |
| **Mode édition pixel** | ✅ | ❌ | 🟢 LOW |

---

## 4. Plan d'Implémentation pour Pixsaur

### Phase 1 : Export ASM Avancé (Sprint 1-2)

#### 4.1 Dialog de Configuration Export
```typescript
// /src/components/export-panel/export-config-dialog.tsx
interface ExportConfig {
  format: 'binary' | 'asm' | 'asm-with-code' | 'dsk';
  compression: 'none' | 'zx0' | 'zx0v2' | 'zx1';
  labels: {
    media: string;      // "ImageCmp"
    palette: string;    // "Palette"
    enabled: boolean;
  };
  includeCode: boolean;     // Inclure routine d'affichage
  includePalette: boolean;
  includeDecompressor: boolean;
}

export const ExportConfigDialog = () => {
  const [config, setConfig] = useAtom(exportConfigAtom);
  
  return (
    <Dialog>
      <TextField label="Media Label" value={config.labels.media} />
      <TextField label="Palette Label" value={config.labels.palette} />
      <Checkbox label="Include display code" checked={config.includeCode} />
      <Select label="Compression">
        <Option value="none">None</Option>
        <Option value="zx0v2">ZX0 V2 (best ratio)</Option>
        <Option value="zx1">ZX1 (faster)</Option>
      </Select>
    </Dialog>
  );
};
```

#### 4.2 Générateur ASM
```typescript
// /src/utils/exports/asm-generator.ts
export class ASMGenerator {
  private config: ExportConfig;
  
  generateASM(imageData: Uint8Array, palette: number[]): string {
    let asm = this.generateHeader();
    
    if (this.config.includeCode) {
      asm += this.generateDisplayCode();
    }
    
    if (this.config.includeDecompressor) {
      asm += this.generateDecompressor();
    }
    
    asm += this.generateData(imageData);
    
    if (this.config.includePalette) {
      asm += this.generatePalette(palette);
    }
    
    return asm;
  }
  
  private generateDecompressor(): string {
    // Port des routines ZX0/ZX1 de ConvImgCpc
    switch(this.config.compression) {
      case 'zx0v2':
        return ZX0V2_DECOMPRESSOR_CODE;
      case 'zx1':
        return ZX1_DECOMPRESSOR_CODE;
      default:
        return '';
    }
  }
  
  private generateData(data: Uint8Array): string {
    const label = this.config.labels.enabled 
      ? `${this.config.labels.media}:\n` 
      : '';
    
    let asm = label;
    for (let i = 0; i < data.length; i += 16) {
      const chunk = data.slice(i, i + 16);
      const hex = Array.from(chunk)
        .map(b => `#${b.toString(16).padStart(2, '0').toUpperCase()}`)
        .join(',');
      asm += `    DB    ${hex}\n`;
    }
    return asm;
  }
}
```

#### 4.3 Templates ASM Prédéfinis
```typescript
// /src/utils/exports/asm-templates.ts
export const ZX0V2_DECOMPRESSOR_CODE = `
; ZX0 V2 Decompressor
; Input: HL = compressed data, DE = destination
Depack:
    LD      BC,#FFFF
    PUSH    BC
    INC     BC
    LD      A,#80
dzx0_literals:
    CALL    dzx0_elias
    LDIR
dzx0_new_offset:
    ADD     A,A
    JR      NC,dzx0_new_offset_skip
    ; ... (code complet)
`;

export const DISPLAY_CODE_TEMPLATE = `
; Display routine
; Initializes palette and displays image
DisplayImage:
    DI
    LD      HL,{paletteLabel}
    CALL    InitPalette
    LD      HL,{mediaLabel}
    LD      DE,#C000
    {decompressCall}
    EI
    RET
`;
```

### Phase 2 : Désactivation de Couleurs (Sprint 2)

#### 4.4 Extension du Système de Palette
```typescript
// /src/app/store/palette/palette.ts
export type ColorSlotState = 'free' | 'locked' | 'disabled';

export interface PaletteSlot {
  color: Vector<'RGB'>;
  state: ColorSlotState;
  used: boolean;  // Indique si la couleur est utilisée dans l'image
}

export const paletteStateAtom = atom<PaletteSlot[]>((get) => {
  const palette = get(reducedPaletteRgbAtom);
  const lockedSlots = get(lockedSlotsAtom);
  const disabledSlots = get(disabledSlotsAtom); // NOUVEAU
  
  return palette.map((color, i) => ({
    color,
    state: disabledSlots.has(i) ? 'disabled' 
         : lockedSlots.has(i) ? 'locked' 
         : 'free',
    used: checkColorUsage(color, get(workingImageAtom))
  }));
});
```

#### 4.5 UI de Désactivation
```typescript
// /src/components/color-palette/color-slot.tsx
export const ColorSlot = ({ index }: { index: number }) => {
  const slot = useAtomValue(paletteStateAtom)[index];
  const [, setDisabled] = useAtom(disabledSlotsAtom);
  
  return (
    <div className={styles.slot}>
      <ColorSwatch color={slot.color} />
      
      {/* Indicateur d'utilisation */}
      {slot.used && <UsageIndicator />}
      
      {/* Checkbox verrouillage */}
      <Checkbox 
        checked={slot.state === 'locked'}
        onChange={(locked) => toggleLock(index, locked)}
      />
      
      {/* Checkbox désactivation */}
      <Checkbox 
        checked={slot.state === 'disabled'}
        onChange={(disabled) => setDisabled(s => 
          disabled ? s.add(index) : s.delete(index)
        )}
        icon={<DisableIcon />}
      />
    </div>
  );
};
```

#### 4.6 Adaptation du Quantizer
```typescript
// /src/libs/pixsaur-adapter/src/quantizer.ts
export const createQuantizerWithDisabled = (
  config: QuantizerConfig,
  disabledSlots: Set<number>
) => {
  const basePalette = generateAmstradCPCPalette();
  
  // Filtrer les couleurs désactivées de la palette de base
  const enabledPalette = basePalette.filter((_, i) => 
    !disabledSlots.has(i)
  );
  
  return createQuantizer({
    ...config,
    basePalette: enabledPalette
  });
};
```

### Phase 3 : Générateur de Palettes (Sprint 3)

#### 4.7 Dialog de Génération
```typescript
// /src/components/palette-generator/palette-generator-dialog.tsx
interface PaletteGeneratorConfig {
  mode: 'gradient' | 'ramp' | 'custom';
  startColor: Vector<'RGB'>;
  endColor: Vector<'RGB'>;
  steps: number;
  colorSpace: 'rgb' | 'lab' | 'hsl';
}

export const PaletteGeneratorDialog = () => {
  const [config, setConfig] = useState<PaletteGeneratorConfig>({
    mode: 'gradient',
    startColor: [0, 0, 0],
    endColor: [255, 255, 255],
    steps: 16,
    colorSpace: 'lab'
  });
  
  const preview = useMemo(() => 
    generatePalette(config), [config]
  );
  
  return (
    <Dialog>
      <Select label="Mode" value={config.mode}>
        <Option value="gradient">Linear Gradient</Option>
        <Option value="ramp">Color Ramp</Option>
        <Option value="custom">Custom</Option>
      </Select>
      
      <ColorPicker label="Start" color={config.startColor} />
      <ColorPicker label="End" color={config.endColor} />
      
      <Slider 
        label="Steps" 
        value={config.steps} 
        min={2} 
        max={16} 
      />
      
      <Select label="Color Space" value={config.colorSpace}>
        <Option value="rgb">RGB</Option>
        <Option value="lab">Lab (perceptual)</Option>
        <Option value="hsl">HSL</Option>
      </Select>
      
      <PalettePreview colors={preview} />
      
      <Button onClick={() => applyPalette(preview)}>
        Apply
      </Button>
    </Dialog>
  );
};
```

#### 4.8 Générateur de Gradient
```typescript
// /src/utils/palette/gradient-generator.ts
export const generateGradient = (
  start: Vector<'RGB'>,
  end: Vector<'RGB'>,
  steps: number,
  colorSpace: 'rgb' | 'lab' | 'hsl' = 'lab'
): Vector<'RGB'>[] => {
  // Conversion dans l'espace de couleur choisi
  const startConverted = convertToSpace(start, colorSpace);
  const endConverted = convertToSpace(end, colorSpace);
  
  const gradient: Vector<'RGB'>[] = [];
  
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    
    // Interpolation linéaire
    const interpolated = startConverted.map((s, j) => 
      s + (endConverted[j] - s) * t
    );
    
    // Reconversion en RGB
    const rgb = convertFromSpace(interpolated, colorSpace);
    
    // Quantification CPC
    const cpcColor = rgb.map(quantizeCPC) as Vector<'RGB'>;
    
    gradient.push(cpcColor);
  }
  
  return gradient;
};
```

### Phase 4 : Export de Tiles (Sprint 4-5)

#### 4.9 Détection et Déduplication
```typescript
// /src/utils/exports/tile-extractor.ts
export interface Tile {
  data: Uint8Array;
  width: number;
  height: number;
  hash: string;
}

export interface TileSet {
  tiles: Tile[];
  tileMap: number[][];
  palette: number[];
}

export const extractTiles = (
  imageData: ImageData,
  tileWidth: number,
  tileHeight: number
): TileSet => {
  const tiles = new Map<string, { tile: Tile; index: number }>();
  const tileMap: number[][] = [];
  
  const cols = Math.floor(imageData.width / tileWidth);
  const rows = Math.floor(imageData.height / tileHeight);
  
  for (let row = 0; row < rows; row++) {
    tileMap[row] = [];
    for (let col = 0; col < cols; col++) {
      const tile = extractTile(imageData, col * tileWidth, row * tileHeight, 
                               tileWidth, tileHeight);
      const hash = calculateTileHash(tile.data);
      
      if (!tiles.has(hash)) {
        tiles.set(hash, { tile, index: tiles.size });
      }
      
      tileMap[row][col] = tiles.get(hash)!.index;
    }
  }
  
  return {
    tiles: Array.from(tiles.values()).map(t => t.tile),
    tileMap,
    palette: extractPalette(imageData)
  };
};
```

#### 4.10 Export Multi-Fichiers
```typescript
// /src/utils/exports/tile-exporter.ts
export const exportTileSet = async (
  tileSet: TileSet,
  basename: string,
  format: 'binary' | 'asm'
) => {
  const zip = new JSZip();
  
  // 1. Données des tiles (.DAT)
  const tileData = serializeTiles(tileSet.tiles);
  zip.file(`${basename}.DAT`, tileData);
  
  // 2. TileMap (.MAP)
  const mapData = serializeTileMap(tileSet.tileMap);
  zip.file(`${basename}.MAP`, mapData);
  
  // 3. Palette (.KIT)
  const paletteData = serializePaletteKit(tileSet.palette);
  zip.file(`${basename}.KIT`, paletteData);
  
  if (format === 'asm') {
    // 4. Fichier ASM avec includes
    const asm = generateTileSetASM(basename, tileSet);
    zip.file(`${basename}.ASM`, asm);
  }
  
  // Téléchargement du ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${basename}.zip`);
};
```

---

## 5. Architecture UI Proposée pour Pixsaur

### 5.1 Nouveau Panel "Advanced Export"

```
┌─ Export Panel ──────────────────────────────┐
│                                              │
│ Format:  [SCR ▼]                            │
│   • Standard (.scr)                         │
│   • Assembler (.asm)                        │
│   • ASM with code (.asm)                    │
│   • DSK Image (.dsk)                        │
│   • Tileset (.zip)                          │
│   • Animation (.asm)                        │
│                                              │
│ ┌─ ASM Options (si ASM sélectionné) ──────┐│
│ │ [✓] Include display code                ││
│ │ [✓] Include decompressor                ││
│ │ [✓] Include palette                     ││
│ │                                          ││
│ │ Media Label:    [ImageCmp   ]           ││
│ │ Palette Label:  [Palette    ]           ││
│ │                                          ││
│ │ Compression: [ZX0 V2 ▼]                 ││
│ │   • None                                 ││
│ │   • ZX0 V2 (best ratio)                 ││
│ │   • ZX1 (faster decompression)          ││
│ └──────────────────────────────────────────┘│
│                                              │
│ ┌─ Tile Options (si Tileset sélectionné) ─┐│
│ │ Tile Size: [16×16 ▼]                    ││
│ │ Export Format: [✓] .DAT  [✓] .MAP       ││
│ │               [✓] .KIT  [✓] .ASM        ││
│ └──────────────────────────────────────────┘│
│                                              │
│          [Preview] [Export]                 │
└──────────────────────────────────────────────┘
```

### 5.2 Palette Panel Amélioré

```
┌─ Palette ────────────────────────────────────┐
│                                               │
│ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  [Generate ▼]│
│ ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜  │ • Gradient    │
│ ⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫⚫  │ • Ramp        │
│                                │ • Gameboy    │
│ Légende:                       │ • C64        │
│  ■ = Couleur active            │ • ZX Spec    │
│  ⬜ = Verrouillée              └──────────────┘
│  ⚫ = Désactivée                               │
│  ● = Utilisée dans l'image                    │
│                                               │
│ Selected: Pen 5                              │
│ RGB: [128] [255] [0  ]                       │
│                                               │
│ [✓] Lock  [✓] Disable  [Edit]  [Sort]       │
└───────────────────────────────────────────────┘
```

---

## 8. Système de Dimensionnement d'Image

### 8.1 Modes de Redimensionnement

ConvImgCpc propose **5 modes** de redimensionnement très complets qui offrent un contrôle précis sur le traitement de l'image source :

```csharp
public enum SizeMode { 
    Fit,          // Adapter (stretcher) à la taille cible
    KeepSmaller,  // Conserver proportions, garder le plus petit
    KeepLarger,   // Conserver proportions, garder le plus grand
    UserSize,     // Taille et position personnalisées
    Origin        // Garder la taille originale (crop si nécessaire)
}
```

#### 8.1.1 Mode **Fit** (Adapter)
```csharp
case Param.SizeMode.Fit:
    g.DrawImage(imgSrc.GetImage, 0, 0, Cpc.TailleX, Cpc.TailleY);
    break;
```
- **Comportement** : Étire ou compresse l'image pour remplir entièrement l'écran CPC
- **Avantage** : Utilise tout l'écran, aucune bande noire
- **Inconvénient** : Peut déformer l'image si ratio différent
- **Usage** : Images abstraites, textures, fonds d'écran sans contrainte de ratio

#### 8.1.2 Mode **KeepSmaller** (Conserver proportions - plus petit)
```csharp
case Param.SizeMode.KeepSmaller:
    double ratio = imgSrc.Width * Cpc.TailleY / (double)(imgSrc.Height * Cpc.TailleX);
    if (ratio < 1) {
        int newW = (int)(Cpc.TailleX * ratio);
        g.DrawImage(imgSrc, (Cpc.TailleX - newW) >> 1, 0, newW, Cpc.TailleY);
    }
    else {
        int newH = (int)(Cpc.TailleY / ratio);
        g.DrawImage(imgSrc, 0, (Cpc.TailleY - newH) >> 1, Cpc.TailleX, newH);
    }
    break;
```
- **Comportement** : L'image tient entièrement dans l'écran, ajout de bandes noires si nécessaire
- **Avantage** : Préserve les proportions, pas de déformation
- **Inconvénient** : N'utilise pas tout l'écran (letterbox/pillarbox)
- **Usage** : Photos, artwork avec ratio important à préserver

#### 8.1.3 Mode **KeepLarger** (Conserver proportions - plus grand)
```csharp
case Param.SizeMode.KeepLarger:
    if (ratio < 1) {
        int newY = (int)(Cpc.TailleY / ratio);
        g.DrawImage(imgSrc, 0, (Cpc.TailleY - newY) >> 1, Cpc.TailleX, newY);
    }
    else {
        int newX = (int)(Cpc.TailleX * ratio);
        g.DrawImage(imgSrc, (Cpc.TailleX - newX) >> 1, 0, newX, Cpc.TailleY);
    }
    break;
```
- **Comportement** : Remplit tout l'écran, crop les parties excédentaires
- **Avantage** : Pas de bandes noires, utilise tout l'écran
- **Inconvénient** : Perd des parties de l'image (crop)
- **Usage** : Extraction d'une zone, focus sur partie centrale

#### 8.1.4 Mode **UserSize** (Taille personnalisée)
```csharp
case Param.SizeMode.UserSize:
    int posx = 0, posy = 0, tx = Cpc.TailleX, ty = Cpc.TailleY;
    GetSizePos(ref posx, ref posy, ref tx, ref ty);
    g.DrawImage(imgSrc.GetImage, -(posx << 1), -(posy << 1), tx << 1, ty << 1);
    break;
```
- **Comportement** : L'utilisateur définit position (X,Y) et taille (W,H) de la zone source
- **Avantage** : Contrôle total pixel-perfect sur la zone extraite
- **Inconvénient** : Nécessite configuration manuelle
- **Usage** : Extraction précise de zone, sprite sheets, recadrage manuel

#### 8.1.5 Mode **Origin** (Taille originale)
```csharp
case Param.SizeMode.Origin:
    // Identique à UserSize mais sans modification utilisateur
    int posx = 0, posy = 0, tx = Cpc.TailleX, ty = Cpc.TailleY;
    GetSizePos(ref posx, ref posy, ref tx, ref ty);
    g.DrawImage(imgSrc.GetImage, -(posx << 1), -(posy << 1), tx << 1, ty << 1);
    break;
```
- **Comportement** : Garde la taille originale de l'image source
- **Avantage** : Pas de redimensionnement, qualité préservée
- **Inconvénient** : Crop si l'image est plus grande que l'écran CPC
- **Usage** : Images déjà aux bonnes dimensions, pixel art

### 8.2 Fonctions de Dimensionnement Avancées

#### 8.2.1 Boutons de Redimensionnement Rapide
```csharp
// Doublement/Division rapide
private void BpXDiv2_Click(object sender, EventArgs e) {
    numSizeX.Value /= 2;
    InterfaceChange(sender, e);
}

private void BpXMul2_Click(object sender, EventArgs e) {
    numSizeX.Value *= 2;
    InterfaceChange(sender, e);
}
// Idem pour Y
```
- **×2 / ÷2** pour X et Y séparément
- Recalcul automatique après changement
- Limites : 16px min, 1920px max (X), 1080px max (Y)

#### 8.2.2 Découpe Interactive (Move/Resize)
```csharp
private void MoveOrSize(MouseEventArgs e) {
    if (e.Button == MouseButtons.Left) {
        // Déplacer la zone de sélection
        if (!movePos) {
            main.GetSizePos(ref posx, ref posy, ref sizex, ref sizey);
            movePos = true;
            memoMouseX = e.X;
            memoMouseY = e.Y;
        }
        else 
            main.SetSizePos(posx + memoMouseX - e.X, posy + memoMouseY - e.Y, 
                           sizex, sizey, true);
    }
    else if (e.Button == MouseButtons.Right) {
        // Redimensionner la zone de sélection
        if (!moveSize) {
            main.GetSizePos(ref posx, ref posy, ref sizex, ref sizey);
            moveSize = true;
            memoMouseX = e.X;
            memoMouseY = e.Y;
        }
        else
            main.SetSizePos(posx, posy, 
                           sizex - memoMouseX + e.X, sizey - memoMouseY + e.Y, 
                           true);
    }
}
```
- **Clic gauche** : Déplacer la zone de sélection
- **Clic droit** : Redimensionner depuis le coin inférieur droit
- Mise à jour en temps réel pendant le drag

#### 8.2.3 Calcul Automatique de Zone (Sprite)
```csharp
private void BpCalcSprite_Click(object sender, EventArgs e) {
    Bitmap bmp = imgSrc.GetImage;
    int xmin = bmp.Width, xmax = 0, ymin = bmp.Height, ymax = 0;
    
    // Trouver les limites du contenu non-transparent
    for (int y = 0; y < bmp.Height; y++) {
        for (int x = 0; x < bmp.Width; x++) {
            if ((bmp.GetPixel(x, y).ToArgb() & 0xFFFFFF) > 0) {
                if (x < xmin) xmin = x;
                if (x > xmax) xmax = x;
                if (y < ymin) ymin = y;
                if (y > ymax) ymax = y;
            }
        }
    }
    
    // Appliquer la zone trouvée
    SetSizePos(xmin, ymin, bmp.Width, bmp.Height);
    if (xmax > xmin) Cpc.TailleX = xmax - xmin;
    if (ymax > ymin) Cpc.TailleY = ymax - ymin;
    Convert(false);
}
```
- **Détection automatique** des zones non-transparentes
- Calcul de bounding box minimale
- Usage : Extraction automatique de sprites depuis sprite sheets

### 8.3 Padding et Remplissage

#### 8.3.1 Remplissage avec Couleur Border
```csharp
public DirectBitmap GetResizeBitmap() {
    DirectBitmap tmp = new DirectBitmap(Cpc.TailleX, Cpc.TailleY);
    Graphics g = Graphics.FromImage(tmp.Bitmap);
    
    // Remplir avec la couleur border (palette[0])
    g.FillRectangle(
        new SolidBrush(Color.FromArgb((int)(0xFF000000 + Cpc.GetPalCPC(Cpc.Palette[0])))), 
        0, 0, Cpc.TailleX, Cpc.TailleY
    );
    
    // Puis dessiner l'image redimensionnée par-dessus
    // ...
}
```
- Les zones vides (letterbox/pillarbox) utilisent **`palette[0]`** (couleur border CPC)
- Cohérence visuelle avec l'affichage CPC réel
- Pas de bandes noires artificielles

### 8.4 Paramètres Ligne de Commande

ConvImgCpc expose ces fonctionnalités en CLI :

```bash
-DX [valeur]  # Déplacement relatif en X
-DY [valeur]  # Déplacement relatif en Y
-NX [valeur]  # Nouvelle taille en X
-NY [valeur]  # Nouvelle taille en Y
-O            # Mode Origin (taille originale)
```

Exemple :
```bash
ConvImgCpc.exe image.png -NX 320 -NY 200 -DX 10 -DY 20 -A
# Redimensionne à 320x200, décale de (10,20), exporte en ASM
```

### 8.5 Comparaison avec Pixsaur

| Fonctionnalité | ConvImgCpc | Pixsaur | Priorité |
|---------------|------------|---------|----------|
| **Mode Fit (stretch)** | ✅ | ✅ | - |
| **Mode KeepSmaller** | ✅ | ❌ | 🟡 MEDIUM |
| **Mode KeepLarger** | ✅ | ❌ | 🟡 MEDIUM |
| **Mode UserSize** | ✅ | ⚠️ Partiel (selection) | 🟡 MEDIUM |
| **Mode Origin** | ✅ | ❌ | 🟢 LOW |
| **Boutons ×2 / ÷2** | ✅ | ❌ | 🟢 LOW |
| **Calcul auto sprite** | ✅ | ❌ | 🟡 MEDIUM |
| **Move/Resize interactif** | ✅ | ⚠️ Partiel | 🟡 MEDIUM |
| **Padding couleur border** | ✅ | ⚠️ Darkest color | 🟢 LOW |
| **CLI dimensionnement** | ✅ | ❌ | 🟢 LOW |
| **Rectangle de sélection visuel** 🌟 | ❌ | ✅ **UNIQUE** | - |
| **Handles redimensionnement** 🌟 | ❌ | ✅ **UNIQUE** | - |
| **Double-click reset** 🌟 | ❌ | ✅ **UNIQUE** | - |
| **État Jotai selection** 🌟 | ❌ | ✅ **UNIQUE** | - |

#### 🌟 Force Unique de Pixsaur : Rectangle de Sélection Interactif

Pixsaur possède une fonctionnalité **absente de ConvImgCpc** : un rectangle de sélection visuel et interactif directement sur l'image source.

**Architecture du système de sélection Pixsaur** :

```typescript
// src/app/store/image/image.ts
export const selectionAtom = atom<Selection | null>(
  (get) => get(_selectionWritableAtom) ?? get(initialSelectionAtom),
  (_get, set, newSel: Selection | null) => {
    set(_selectionWritableAtom, newSel)
  }
)

export const initialSelectionAtom = atom((get) => {
  const downscaled = get(downscaledAtom)
  if (!downscaled) return null
  return {
    sx: 0,      // Start X
    sy: 0,      // Start Y
    width: downscaled.width,
    height: downscaled.height
  }
})
```

**Composant SourceSelector** :

```typescript
// src/components/source-selector/source-selector.tsx
export const SourceSelector = ({ width, height }: SourceSelectorProps) => {
  const selection = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(setSelectionAtom)
  
  // Features:
  // ✅ Draggable rectangle - Déplacer la sélection en cliquant à l'intérieur
  // ✅ Resizable handles - 4 poignées aux coins pour redimensionner
  // ✅ Double-click reset - Double-clic pour sélectionner toute l'image
  // ✅ Visual feedback - Fond semi-transparent pendant drag/resize
  // ✅ Bounds clamping - Impossible de sortir des limites de l'image
  // ✅ Responsive - Fonctionne en coordonnées % pour adaptation écran
}
```

**Fonctionnalités du rectangle de sélection** :

1. **Déplacement (Drag)** :
   - Clic à l'intérieur du rectangle → déplace la sélection
   - Maintien des proportions pendant le drag
   - Clamp automatique aux bords de l'image

2. **Redimensionnement (Resize)** :
   - 4 handles aux coins (top-left, top-right, bottom-left, bottom-right)
   - Drag d'un handle → redimensionne depuis ce coin
   - Taille minimale respectée (évite les sélections trop petites)

3. **Reset (Double-click)** :
   - Double-clic n'importe où → reset à toute l'image
   - Shortcut clavier possible (à implémenter)

4. **Feedback visuel** :
   - Rectangle avec bordure en pointillés
   - Fond semi-transparent pendant interaction
   - Poignées visibles aux 4 coins
   - Classes CSS : `selection-rect`, `selection-rect--active`

5. **Intégration pipeline** :
   ```typescript
   // src/utils/get-visual-region.ts
   export function getVisualRegion(
     imageData: ImageData,
     selection: Selection  // ← Utilise le selectionAtom
   ): ImageData {
     const { sx, sy, width: sw, height: sh } = selection
     // Extraction de la région sélectionnée
     // Puis downscale à la taille cible CPC
   }
   ```

**Comparaison des workflows** :

| Action | ConvImgCpc | Pixsaur |
|--------|------------|---------|
| **Sélectionner une zone** | NumericUpDown (X,Y,W,H) | Rectangle visuel + drag |
| **Voir la zone sélectionnée** | ❌ Pas de feedback visuel | ✅ Rectangle sur l'image |
| **Ajuster la zone** | Re-saisir les valeurs | Drag handles interactifs |
| **Reset** | Bouton "Reset" | Double-click |
| **Feedback temps réel** | ❌ Non | ✅ Oui (preview live) |

**Avantage UX de Pixsaur** :
- 🎯 **WYSIWYG** : Ce que vous voyez = ce que vous convertissez
- 🖱️ **Intuitif** : Pas de saisie de coordonnées numériques
- ⚡ **Rapide** : Ajustements en temps réel sans re-saisie
- 🎨 **Visuel** : Feedback immédiat de la zone sélectionnée
- 🔄 **Réactif** : Atoms Jotai = mise à jour instantanée du preview

**ConvImgCpc équivalent** :
ConvImgCpc utilise une approche **numérique pure** :
```csharp
// Contrôles Windows Forms
numPosX.Value = 100;   // Position X
numPosY.Value = 50;    // Position Y  
numSizeX.Value = 320;  // Largeur
numSizeY.Value = 200;  // Hauteur

// Move/Resize via souris mais SANS rectangle visible
private void MoveOrSize(MouseEventArgs e) {
    // Drag = déplace numPosX/Y
    // Right-click drag = redimensionne numSizeX/Y
    // ❌ MAIS pas de rectangle visible sur l'image source !
}
```

**Conclusion** :
Le rectangle de sélection de Pixsaur est une **innovation UX majeure** par rapport à ConvImgCpc. Cette fonctionnalité devrait être **préservée et améliorée** lors de l'ajout des 5 modes de redimensionnement :

```typescript
// Proposition : Combiner les forces des deux approches
interface ExtendedSelection extends Selection {
  mode: ResizeMode  // 'fit' | 'keepSmaller' | 'keepLarger' | 'userSize' | 'origin'
}

// Le rectangle de sélection définit la zone source (sx, sy, width, height)
// Le mode définit comment cette zone est adaptée à la taille cible CPC
// ✅ Meilleur des deux mondes : Visuel + Flexible
```

### 8.6 Plan d'Implémentation pour Pixsaur

#### Phase 1 : Modes de Redimensionnement (Sprint 2)

**Objectif** : Ajouter les 5 modes de ConvImgCpc + **taille de destination personnalisée**

```typescript
// src/app/store/image/types.ts
export type ResizeMode = 
  | 'fit'          // Stretch to fill
  | 'keepSmaller'  // Fit inside (letterbox)
  | 'keepLarger'   // Fill screen (crop)
  | 'userSize'     // Custom position & size
  | 'origin'       // Keep original size

// src/app/store/config/types.ts
export interface ImageConfig {
  // ... existing config
  resizeMode: ResizeMode
  customPosition: { x: number; y: number }
  customSize: { width: number; height: number }
  
  // 🌟 NOUVELLE FEATURE: Taille de destination personnalisée
  targetWidth: number   // Largeur CPC (par défaut: 160, 320, 640)
  targetHeight: number  // Hauteur CPC (par défaut: 200, 272)
  maxMemory: number     // Limite mémoire en bytes (par défaut: 16384 = 16Ko)
}

// Validation de la taille
export const validateTargetSize = (
  width: number, 
  height: number, 
  mode: number
): { valid: boolean; memory: number; message?: string } => {
  const bytesPerPixel = mode === 0 ? 0.5 : mode === 1 ? 1 : 2;
  const memory = Math.ceil(width * height * bytesPerPixel);
  
  if (memory > 65536) {
    return {
      valid: false,
      memory,
      message: `Taille trop grande: ${memory} bytes (max: 64Ko)`
    };
  }
  
  if (width % 8 !== 0) {
    return {
      valid: false,
      memory,
      message: `Largeur doit être multiple de 8 (actuel: ${width})`
    };
  }
  
  if (height % 2 !== 0) {
    return {
      valid: false,
      memory,
      message: `Hauteur doit être paire (actuel: ${height})`
    };
  }
  
  return { valid: true, memory };
}
```

**Composant UI** : Nouveau panel "Image Sizing"
```tsx
// src/components/image-sizing/image-sizing.tsx
export const ImageSizing = () => {
  const [config, setConfig] = useAtom(configAtom)
  const [validation, setValidation] = useState({ valid: true, memory: 0 })
  
  // Presets communs CPC
  const presets = [
    { name: 'Mode 0 Standard', width: 160, height: 200, mode: 0 },
    { name: 'Mode 1 Standard', width: 320, height: 200, mode: 1 },
    { name: 'Mode 2 Standard', width: 640, height: 200, mode: 2 },
    { name: 'Mode 1 Overscan', width: 384, height: 272, mode: 1 },
    { name: 'Mode 2 Overscan', width: 768, height: 272, mode: 2 },
  ]
  
  const handleSizeChange = (width: number, height: number) => {
    const result = validateTargetSize(width, height, config.cpcMode)
    setValidation(result)
    if (result.valid) {
      setConfig({...config, targetWidth: width, targetHeight: height})
    }
  }
  
  return (
    <div className={styles.panel}>
      {/* Section 1: Presets rapides */}
      <div className={styles.presets}>
        <label>Presets CPC:</label>
        <Select onValueChange={(preset) => {
          const p = presets.find(x => x.name === preset)
          if (p) handleSizeChange(p.width, p.height)
        }}>
          {presets.map(p => (
            <SelectItem key={p.name} value={p.name}>
              {p.name} ({p.width}×{p.height}) - {
                Math.ceil(p.width * p.height * (p.mode === 0 ? 0.5 : p.mode === 1 ? 1 : 2) / 1024)
              }Ko
            </SelectItem>
          ))}
        </Select>
      </div>
      
      {/* Section 2: Taille personnalisée */}
      <div className={styles.customSize}>
        <label>Taille Destination (CPC):</label>
        <div className={styles.sizeInputs}>
          <div>
            <label>Largeur (multiple de 8):</label>
            <input 
              type="number" 
              min={8} 
              max={768}
              step={8}
              value={config.targetWidth}
              onChange={(e) => handleSizeChange(
                Number(e.target.value), 
                config.targetHeight
              )}
            />
          </div>
          <div>
            <label>Hauteur (paire):</label>
            <input 
              type="number" 
              min={2} 
              max={544}
              step={2}
              value={config.targetHeight}
              onChange={(e) => handleSizeChange(
                config.targetWidth,
                Number(e.target.value)
              )}
            />
          </div>
        </div>
        
        {/* Indicateur mémoire */}
        <div className={
          validation.valid ? styles.memoryOk : styles.memoryError
        }>
          {validation.valid ? (
            <>
              ✅ Mémoire: {(validation.memory / 1024).toFixed(2)} Ko / 64 Ko
              {validation.memory <= 16384 && ' (Standard 16Ko)'}
            </>
          ) : (
            <>
              ❌ {validation.message}
            </>
          )}
        </div>
      </div>
      
      {/* Section 3: Mode de redimensionnement */}
      <RadioGroup value={config.resizeMode} 
                  onValueChange={(mode) => setConfig({...config, resizeMode: mode})}>
        <RadioGroupItem value="fit">
          Fit (Stretch) - Remplir la destination
        </RadioGroupItem>
        <RadioGroupItem value="keepSmaller">
          Keep Smaller (Letterbox) - Préserver ratio, ajouter bandes
        </RadioGroupItem>
        <RadioGroupItem value="keepLarger">
          Keep Larger (Crop) - Préserver ratio, couper excédent
        </RadioGroupItem>
        <RadioGroupItem value="userSize">
          Custom Size - Position et taille personnalisées
        </RadioGroupItem>
        <RadioGroupItem value="origin">
          Original Size - Garder taille source
        </RadioGroupItem>
      </RadioGroup>
      
      {config.resizeMode === 'userSize' && (
        <div className={styles.customControls}>
          <label>Position Source:</label>
          <label>X: <input type="number" value={config.customPosition.x} /></label>
          <label>Y: <input type="number" value={config.customPosition.y} /></label>
          <label>Taille Source:</label>
          <label>Width: <input type="number" value={config.customSize.width} /></label>
          <label>Height: <input type="number" value={config.customSize.height} /></label>
          <div className={styles.quickButtons}>
            <Button onClick={() => multiplySize('width', 2)}>W × 2</Button>
            <Button onClick={() => multiplySize('width', 0.5)}>W ÷ 2</Button>
            <Button onClick={() => multiplySize('height', 2)}>H × 2</Button>
            <Button onClick={() => multiplySize('height', 0.5)}>H ÷ 2</Button>
          </div>
        </div>
      )}
      
      {/* Section 4: Intégration Rectangle de sélection */}
      <div className={styles.selectionIntegration}>
        <p>💡 Astuce: Utilisez le rectangle de sélection visuel pour définir 
           la zone source, puis choisissez comment l'adapter à la taille destination.</p>
        <Button onClick={() => {
          // Lier au rectangle de sélection existant
          const selection = get(selectionAtom)
          setConfig({
            ...config,
            resizeMode: 'userSize',
            customPosition: { x: selection.sx, y: selection.sy },
            customSize: { width: selection.width, height: selection.height }
          })
        }}>
          📐 Utiliser Rectangle Sélection Actuel
        </Button>
      </div>
    </div>
  )
}
```

**Logique de redimensionnement**
```typescript
// src/utils/image-resize.ts
export function resizeImage(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  mode: ResizeMode,
  customPos?: { x: number; y: number },
  customSize?: { width: number; height: number }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!
  
  // Fill with palette[0] color
  ctx.fillStyle = getBackgroundColor()
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  
  const ratio = sourceCanvas.width * targetHeight / (sourceCanvas.height * targetWidth)
  
  switch (mode) {
    case 'fit':
      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
      break
      
    case 'keepSmaller':
      if (ratio < 1) {
        const newW = targetWidth * ratio
        ctx.drawImage(sourceCanvas, (targetWidth - newW) / 2, 0, newW, targetHeight)
      } else {
        const newH = targetHeight / ratio
        ctx.drawImage(sourceCanvas, 0, (targetHeight - newH) / 2, targetWidth, newH)
      }
      break
      
    case 'keepLarger':
      if (ratio < 1) {
        const newY = targetHeight / ratio
        ctx.drawImage(sourceCanvas, 0, (targetHeight - newY) / 2, targetWidth, newY)
      } else {
        const newX = targetWidth * ratio
        ctx.drawImage(sourceCanvas, (targetWidth - newX) / 2, 0, newX, targetHeight)
      }
      break
      
    case 'userSize':
      if (customPos && customSize) {
        ctx.drawImage(sourceCanvas, 
          -customPos.x, -customPos.y, 
          customSize.width, customSize.height)
      }
      break
      
    case 'origin':
      ctx.drawImage(sourceCanvas, 0, 0)
      break
  }
  
  return canvas
}

// 🌟 NOUVEAU: Calcul de la mémoire nécessaire
export function calculateMemoryUsage(
  width: number,
  height: number,
  mode: 0 | 1 | 2
): { bytes: number; kb: number; valid: boolean; message: string } {
  // Mode 0: 4 pixels par byte (0.25 byte/pixel)
  // Mode 1: 2 pixels par byte (0.5 byte/pixel)  
  // Mode 2: 1 pixel par byte (1 byte/pixel)
  const bytesPerPixel = mode === 0 ? 0.25 : mode === 1 ? 0.5 : 1
  
  // Calcul avec entrelacement CPC
  const lines = Math.floor(height / 2)
  const bytesPerLine = Math.ceil(width * bytesPerPixel)
  const bytes = lines * bytesPerLine * 8 // 8 blocs entrelacés
  
  const kb = bytes / 1024
  const valid = bytes <= 65536
  
  let message = `${width}×${height} Mode ${mode}: ${kb.toFixed(2)} Ko`
  if (!valid) {
    message += ` ❌ (max: 64Ko)`
  } else if (bytes <= 16384) {
    message += ` ✅ (Standard 16Ko)`
  } else {
    message += ` ⚠️ (Nécessite banques mémoire)`
  }
  
  return { bytes, kb, valid, message }
}

// 🌟 NOUVEAU: Suggestions de tailles valides
export function suggestValidSizes(
  desiredWidth: number,
  desiredHeight: number,
  mode: 0 | 1 | 2
): Array<{ width: number; height: number; memory: number }> {
  const suggestions: Array<{ width: number; height: number; memory: number }> = []
  
  // Arrondir aux contraintes CPC
  const roundWidth = Math.floor(desiredWidth / 8) * 8
  const roundHeight = Math.floor(desiredHeight / 2) * 2
  
  // Suggestion 1: Arrondi simple
  const mem1 = calculateMemoryUsage(roundWidth, roundHeight, mode)
  if (mem1.valid) {
    suggestions.push({ width: roundWidth, height: roundHeight, memory: mem1.bytes })
  }
  
  // Suggestion 2: Réduire largeur si trop grand
  if (!mem1.valid && roundWidth > 160) {
    let w = roundWidth
    while (w >= 160) {
      w -= 8
      const mem = calculateMemoryUsage(w, roundHeight, mode)
      if (mem.valid) {
        suggestions.push({ width: w, height: roundHeight, memory: mem.bytes })
        break
      }
    }
  }
  
  // Suggestion 3: Réduire hauteur si trop grand
  if (!mem1.valid && roundHeight > 200) {
    let h = roundHeight
    while (h >= 200) {
      h -= 2
      const mem = calculateMemoryUsage(roundWidth, h, mode)
      if (mem.valid) {
        suggestions.push({ width: roundWidth, height: h, memory: mem.bytes })
        break
      }
    }
  }
  
  // Suggestion 4: Standard 16Ko le plus proche
  const standardSizes = [
    { w: 160, h: 200 }, // Mode 0
    { w: 320, h: 200 }, // Mode 1
    { w: 640, h: 200 }, // Mode 2
  ]
  const standard = standardSizes.find(s => {
    const mem = calculateMemoryUsage(s.w, s.h, mode)
    return mem.bytes <= 16384
  })
  if (standard) {
    suggestions.push({ 
      width: standard.w, 
      height: standard.h, 
      memory: calculateMemoryUsage(standard.w, standard.h, mode).bytes 
    })
  }
  
  return suggestions.slice(0, 3) // Max 3 suggestions
}
```

#### Phase 2 : Calcul Automatique (Sprint 3)

**Fonction de détection** :
```typescript
// src/utils/auto-crop.ts
export function calculateSpriteBounds(
  imageData: ImageData
): { x: number; y: number; width: number; height: number } {
  let xmin = imageData.width, xmax = 0
  let ymin = imageData.height, ymax = 0
  
  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      const idx = (y * imageData.width + x) * 4
      const alpha = imageData.data[idx + 3]
      
      // Pixel non-transparent
      if (alpha > 0) {
        if (x < xmin) xmin = x
        if (x > xmax) xmax = x
        if (y < ymin) ymin = y
        if (y > ymax) ymax = y
      }
    }
  }
  
  return {
    x: xmin,
    y: ymin,
    width: xmax - xmin + 1,
    height: ymax - ymin + 1
  }
}
```

**Bouton UI** :
```tsx
<Button onClick={() => {
  const bounds = calculateSpriteBounds(workingImage)
  setConfig({
    ...config,
    resizeMode: 'userSize',
    customPosition: { x: bounds.x, y: bounds.y },
    customSize: { width: bounds.width, height: bounds.height }
  })
}}>
  Auto-Crop Sprite
</Button>
```

#### Effort Estimé
- **Phase 1** : 5 jours (modes + UI + validation taille + presets + calcul mémoire)
- **Phase 2** : 1 jour (auto-crop)
- **Total** : ~1,5 semaine

#### Bénéfices
- ✅ **Flexibilité** : 5 modes couvrant tous les cas d'usage
- ✅ **Productivité** : Auto-crop pour sprites
- ✅ **Contrôle** : Boutons ×2/÷2 pour ajustements rapides
- ✅ **Compatibilité** : Workflow identique à ConvImgCpc
- ✅ **🌟 Taille personnalisée** : Choix libre de la résolution CPC dans limite 64Ko
- ✅ **🌟 Validation temps réel** : Calcul mémoire instantané avec feedback visuel
- ✅ **🌟 Presets intelligents** : Tailles standard CPC pré-configurées
- ✅ **🌟 Suggestions auto** : Propositions de tailles valides si dépassement

---

## 9. Résumé des Priorités (Mise à Jour)

### 🔴 HIGH Priority (Sprint 1-2)

1. **Export ASM avec code**
   - Dialog de configuration
   - Génération labels configurables
   - Templates de routines d'affichage
   - Support compression ZX0/ZX1

2. **Désactivation de couleurs**
   - Extension `PaletteSlot` avec état `disabled`
   - UI checkbox désactivation
   - Adaptation quantizer pour exclure couleurs désactivées

### 🟡 MEDIUM Priority (Sprint 2-4)

3. **Modes de redimensionnement** (✨ NOUVEAU)
   - Implémentation des 5 modes (Fit, KeepSmaller, KeepLarger, UserSize, Origin)
   - UI Radio buttons + contrôles custom
   - Boutons ×2 / ÷2 pour X et Y
   - Auto-crop sprite avec détection de transparence
   - **🌟 Taille destination personnalisée** (largeur/hauteur libre dans limite 64Ko)
   - **🌟 Validation temps réel** avec calcul mémoire CPC
   - **🌟 Presets CPC** (Standard, Overscan, modes 0/1/2)
   - **🌟 Suggestions intelligentes** si taille invalide

4. **Générateur de palettes**
   - Dialog avec gradient RGB/Lab/HSL
   - Presets (Gameboy, C64, ZX Spectrum)
   - Application à la palette active

5. **Export Tileset**
   - Extraction et déduplication
   - Export multi-fichiers (.DAT/.MAP/.KIT)
   - Format ASM optionnel

### 🟢 LOW Priority (Backlog)

6. **Export animations DeltaPack**
7. **Éditeur split-screen**
8. **Sprites hardware CPC Plus**
9. **Mode édition pixel**

---

## 10. Conclusion

### 🔴 HIGH Priority (Sprint 1-2)

1. **Export ASM avec code**
   - Dialog de configuration
   - Génération labels configurables
   - Templates de routines d'affichage
   - Support compression ZX0/ZX1

2. **Désactivation de couleurs**
   - Extension `PaletteSlot` avec état `disabled`
   - UI checkbox désactivation
   - Adaptation quantizer pour exclure couleurs désactivées

### 🟡 MEDIUM Priority (Sprint 3-4)

3. **Générateur de palettes**
   - Dialog avec gradient RGB/Lab/HSL
   - Presets (Gameboy, C64, ZX Spectrum)
   - Application à la palette active

4. **Export Tileset**
   - Extraction et déduplication
   - Export multi-fichiers (.DAT/.MAP/.KIT)
   - Format ASM optionnel

### 🟢 LOW Priority (Backlog)

5. **Export animations DeltaPack**
6. **Éditeur split-screen**
7. **Sprites hardware CPC Plus**
8. **Mode édition pixel**

---

## 10. Conclusion

L'analyse de l'UI et des exports de ConvImgCpc révèle un système très complet orienté développeurs CPC. Les points forts à retenir :

### Forces de ConvImgCpc
- **Flexibilité d'export** : 17+ formats adaptés à tous les usages
- **Configuration fine** : Labels ASM, options de compression, code intégré
- **Workflow tileset** : Déduplication automatique, export multi-fichiers
- **Palette avancée** : Verrouillage ET désactivation, générateur de gradients
- **Redimensionnement intelligent** : 5 modes couvrant tous les cas d'usage, auto-crop sprite

### Avantages de Pixsaur
- **Interface moderne** : React + Radix UI vs WinForms
- **Performance GPU** : ReGL/WebGL pour quantification en temps réel
- **Architecture atomique** : Jotai pour gestion d'état prévisible
- **Web-based** : Pas d'installation, multiplateforme
- **TypeScript** : Type-safety et maintenabilité
- **🌟 Rectangle de sélection interactif** : WYSIWYG avec drag & resize visuel (absent de ConvImgCpc)

### Opportunités d'Amélioration Identifiées
Le plan d'implémentation proposé permettrait à Pixsaur de devenir **l'outil de référence** pour la conversion d'images CPC, en combinant :
- La **modernité** de React/TypeScript
- La **puissance** de ConvImgCpc (exports ASM, tiles, dimensionnement)
- Les **innovations** de Pixsaur (GPU, atoms, UI moderne, **rectangle de sélection visuel**)

**Priorités absolues** : 
1. Export ASM avec code (Sprint 1)
2. Désactivation couleurs (Sprint 2)  
3. Modes de redimensionnement (Sprint 2-3) - **À intégrer avec le rectangle de sélection existant**

### Résumé des Fonctionnalités Analysées

| Catégorie | Fonctionnalités | Impact |
|-----------|----------------|--------|
| **Export** | 17+ formats, ASM avec code, compression | 🔴 HIGH |
| **Palette** | Verrouillage, désactivation, générateur | 🔴 HIGH |
| **Dimensionnement** | 5 modes, auto-crop, ×2/÷2 | 🟡 MEDIUM |
| **Tileset** | Déduplication, multi-export | 🟡 MEDIUM |
| **Animation** | DeltaPack, DiffImage | 🟢 LOW |
| **Split-screen** | Rasters, éditeur | 🟢 LOW |

**Total pages analysées** : 1200+ lignes de code C#  
**Documents produits** : 2 (CONVIMGCPC_ANALYSIS.md + CONVIMGCPC_UI_EXPORT_ANALYSIS.md)  
**Opportunités identifiées** : 15+ fonctionnalités  
**Effort estimé** : 8-10 sprints (16-20 semaines) pour implémentation complète

---

**Date de finalisation** : 19 octobre 2025  
**Prochaines étapes** : Commencer Sprint 1 avec Export ASM
