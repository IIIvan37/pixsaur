# Cahier des charges - Intégration RASM dans Pixsaur

## 📋 Objectif général

Intégrer l'assembleur Z80 RASM (via WebAssembly) dans Pixsaur pour permettre l'export d'images converties sous forme de programmes CPC exécutables (snapshots .SNA, disquettes .DSK, cartouches .CPR).

---

## 🎯 Fonctionnalités principales

### 1. Export Snapshot (.SNA)

**Description**: Générer un snapshot Amstrad CPC exécutable contenant le code d'affichage de l'image convertie.

**Spécifications**:

- [ ] Générer automatiquement le code Z80 pour afficher l'image
- [ ] Inclure les données de l'image (pixels + palette) dans le code ASM
- [ ] Compiler avec RASM WASM
- [ ] Télécharger le fichier .SNA résultant
- [ ] Paramètres configurables :
  - Adresse de chargement (défaut: #8000)
  - Mode d'affichage (0, 1, 2)
  - Vitesse d'affichage (immédiat / progressif)

**Cas d'usage**:

- Utilisateur convertit une image
- Clique sur "Export as Snapshot"
- Télécharge un .SNA qu'il peut charger dans un émulateur CPC

---

### 2. Export Disquette (.DSK)

**Description**: Créer une disquette virtuelle CPC contenant l'image et un loader.

**Spécifications**:

- [ ] Générer un fichier BASIC qui charge et affiche l'image
- [ ] Générer le code machine d'affichage
- [ ] Sauvegarder les fichiers sur le DSK via directives RASM `SAVE`
- [ ] Télécharger le fichier .DSK résultant
- [ ] Paramètres configurables :
  - Nom du fichier sur le DSK
  - Auto-run (disquette bootable ou non)
  - Inclure plusieurs images sur le même DSK

**Cas d'usage**:

- Utilisateur convertit plusieurs images
- Les exporte toutes sur une même disquette DSK
- Le DSK peut être utilisé dans un CPC réel ou émulateur

---

### 3. Export Cartouche (.CPR)

**Description**: Créer une cartouche CPC Plus contenant l'image.

**Spécifications**:

- [ ] Générer le code pour CPC Plus
- [ ] Optimiser pour la palette étendue du Plus (4096 couleurs)
- [ ] Compiler en format cartouche
- [ ] Télécharger le fichier .CPR résultant

**Cas d'usage**:

- Utilisateur cible spécifiquement le CPC Plus
- Exporte en .CPR pour émulateur ou flashcart

---

## 🔧 Architecture technique

### Composants à créer/modifier

#### 1. **Générateur de code ASM** (`src/libs/rasm-wasm/code-generator.ts`)

```typescript
interface CodeGeneratorOptions {
  imageData: Uint8Array;
  palette: number[];
  width: number;
  height: number;
  mode: 0 | 1 | 2;
  loadAddress: number;
  entryPoint: number;
}

function generateDisplayCode(options: CodeGeneratorOptions): string;
function generateBasicLoader(filename: string): string;
function generateDskSaveDirectives(files: DskFile[]): string;
```

**Responsabilités**:

- Générer le code ASM d'affichage de l'image
- Inclure les données image en tant que données binaires dans l'ASM
- Gérer les palettes CPC (27 couleurs) et CPC Plus (4096 couleurs)
- Optimiser le code selon le mode graphique

---

#### 2. **Composant Export Panel** (`src/components/export-panel/`)

```typescript
interface ExportOptions {
  format: "sna" | "dsk" | "cpr" | "bin";
  includeLoader: boolean;
  autoRun: boolean;
  targetMachine: "cpc" | "cpcplus";
  // ... autres options
}
```

**UI**:

- Onglets pour chaque format (SNA / DSK / CPR / Binary)
- Formulaire de configuration par format
- Bouton "Generate & Download"
- Prévisualisation du code ASM généré (optionnel)
- Zone de logs pour les erreurs RASM

---

#### 3. **Integration dans le workflow principal**

**Modifications de `ImageConverter`**:

- Ajouter un bouton "Advanced Export" après la conversion
- Ouvrir le panneau d'export avec l'image convertie
- Passer les données (pixels, palette, dimensions) au générateur

---

## 📝 Templates de code ASM

### Template 1: Affichage simple (Mode 0)

```asm
org #8000
run $

; Clear screen
ld a,1
call #bc0e

; Set palette
ld hl,palette_data
ld b,16
call set_palette

; Display image
ld hl,image_data
ld de,#c000
ld bc,16384
ldir

ret

palette_data:
  ; Palette CPC (16 couleurs)
  db ...

image_data:
  ; Données de l'image
  incbin "image.bin"
```

### Template 2: Affichage progressif avec effets

```asm
; Affichage ligne par ligne avec délai
; Pour un effet "loading"
```

### Template 3: DSK avec BASIC loader

```asm
; Fichier machine à sauver sur DSK
save "image.bin",#c000,16384

; Programme BASIC (généré séparément)
; 10 MEMORY #7FFF
; 20 LOAD "image.bin"
; 30 CALL #8000
```

---

## 🎨 UI/UX

### Workflow utilisateur type

1. **Conversion de l'image**

   - Utilisateur uploade une image
   - Choix des paramètres (mode, palette, dithering)
   - Prévisualisation du résultat

2. **Export avancé** (nouveau)

   - Clic sur "Advanced Export" → ouvre un panneau modal/drawer
   - Choix du format : SNA / DSK / CPR
   - Configuration des options spécifiques
   - Prévisualisation du code généré (optionnel)
   - Bouton "Generate" → compilation RASM WASM
   - Affichage des logs/erreurs
   - Téléchargement automatique du fichier

3. **Gestion des erreurs**
   - Si RASM retourne une erreur : afficher dans la console de logs
   - Permettre modification manuelle du code (mode expert)
   - Re-compilation à la demande

---

## ✅ Critères d'acceptation

### Fonctionnels

- [ ] Un snapshot .SNA généré peut être chargé dans un émulateur CPC et affiche correctement l'image
- [ ] Un DSK généré contient les fichiers attendus et peut être booté
- [ ] Le code ASM généré est optimal (pas de code mort, taille minimale)
- [ ] Les palettes sont correctement converties CPC ↔ RGB
- [ ] Support des 3 modes graphiques (0, 1, 2)

### Techniques

- [ ] Compilation RASM en moins de 2 secondes
- [ ] Pas de blocage de l'UI pendant la compilation
- [ ] Gestion d'erreur robuste (RASM, génération de code)
- [ ] Code testable unitairement
- [ ] Documentation du générateur de code

### UX

- [ ] Interface intuitive même pour utilisateurs non-techniques
- [ ] Feedback visuel pendant la génération
- [ ] Messages d'erreur clairs et exploitables
- [ ] Options avancées masquées par défaut (progressive disclosure)

---

## 📦 Livrables

1. **Code**

   - `src/libs/rasm-wasm/code-generator.ts` - Générateur de code ASM
   - `src/components/export-panel/` - Composant UI d'export
   - `src/libs/rasm-wasm/templates/` - Templates ASM
   - Tests unitaires pour le générateur

2. **Documentation**

   - Guide utilisateur : comment exporter une image en SNA/DSK
   - Documentation technique : architecture du générateur de code
   - Exemples de code ASM généré

3. **Tests**
   - Tests unitaires du générateur de code
   - Tests d'intégration RASM WASM
   - Tests des fichiers générés (validation format SNA/DSK)

---

## 🚀 Roadmap / Phases

### Phase 1 : Export DSK avec SCR (MVP)

- Générer un fichier .SCR (16Ko de données écran brutes)
- Créer un DSK contenant le .SCR via directives SAVE de RASM
- Générer un loader BASIC simple
- UI minimale (un bouton "Export DSK")
- **Durée estimée** : 1-2 jours
- **Livrables** :
  - Générateur de fichier SCR depuis les données image
  - Code ASM avec directives SAVE
  - Loader BASIC (LOAD + affichage)
  - DSK téléchargeable fonctionnel

### Phase 2 : Export Snapshot (SNA)

- Générateur de code ASM pour affichage
- Export SNA avec affichage simple
- Inclure les données image dans le code
- **Durée estimée** : 2-3 jours

### Phase 3 : Options avancées

- Effets d'affichage (progressif, wipe, etc.)
- Optimisations du code généré
- Support CPC Plus et cartouches
- Mode expert (édition code ASM)
- **Durée estimée** : 3-4 jours

---

## 🎯 Phase 1 détaillée : Export DSK avec SCR

### Objectif

Créer une disquette DSK contenant :

1. Un fichier `.SCR` (16Ko de données écran)
2. Un programme BASIC qui charge et affiche le .SCR

### Format SCR

Le format `.SCR` est simplement une copie brute de la VRAM CPC :

- **Taille** : 16384 bytes (16Ko)
- **Adresse** : #C000 - #FFFF
- **Contenu** : Données des 3 banks écran entrelacées
- **Palette** : Non incluse dans le SCR (gérée par le loader)

### Architecture technique

#### 1. Générateur de SCR (`src/libs/cpc/scr-generator.ts`)

```typescript
interface ScrGeneratorOptions {
  imageData: Uint8Array; // Données pixel déjà converties au format CPC
  mode: 0 | 1 | 2;
}

/**
 * Génère un fichier SCR (16Ko) depuis les données image converties
 * Les données doivent être déjà au format CPC (entrelacement fait)
 */
export function generateScr(options: ScrGeneratorOptions): Uint8Array {
  // Le SCR fait toujours 16Ko même si l'image est plus petite
  const scr = new Uint8Array(16384);

  // Copier les données image (qui sont déjà au format CPC correct)
  scr.set(options.imageData.slice(0, 16384));

  return scr;
}
```

#### 2. Générateur de code ASM pour DSK (`src/libs/rasm-wasm/dsk-generator.ts`)

```typescript
interface DskGeneratorOptions {
  scrData: Uint8Array; // Données SCR (16Ko)
  palette: number[]; // Palette CPC (16 valeurs)
  screenFilename: string; // Nom du .SCR sur le DSK (ex: "IMAGE.SCR")
  basicFilename: string; // Nom du .BAS (ex: "LOADER.BAS")
}

/**
 * Génère le code ASM qui crée un DSK avec le SCR et le loader BASIC
 */
export function generateDskCode(options: DskGeneratorOptions): string {
  // Template du code ASM
  return `
; DSK Generator - Pixsaur Export
org #8000

; Binary data for the screen
screen_data:
${generateBinaryData(options.scrData)}

; Palette data
palette_data:
${generatePaletteData(options.palette)}

; Save screen to DSK
save "${options.screenFilename}", screen_data, 16384, DSK, "pixsaur.dsk"

; BASIC loader (saved as ASCII)
basic_loader:
${generateBasicLoader(options.screenFilename, options.palette)}

save "${
    options.basicFilename
  }", basic_loader, #end_basic - basic_loader, DSK, "pixsaur.dsk", 0 ; 0 = ASCII BASIC
end_basic:
`;
}
```

#### 3. Template BASIC loader

```basic
10 MODE 0: ' ou MODE 1 ou MODE 2
20 FOR I=0 TO 15: INK I,palette(I): NEXT
30 LOAD "IMAGE.SCR",#C000
40 ' Attendre une touche
50 IF INKEY$="" THEN GOTO 50
60 MODE 1: ' Retour mode texte
```

Version plus compacte :

```basic
10 MODE 0:FOR I=0 TO 15:INK I,palette(I):NEXT:LOAD"IMAGE.SCR",&C000
```

#### 4. Composant UI (`src/components/export-dsk/export-dsk-button.tsx`)

```typescript
interface ExportDskButtonProps {
  imageData: Uint8Array; // Données image converties (format CPC)
  palette: number[]; // Palette CPC
  mode: 0 | 1 | 2;
  width: number;
  height: number;
}

export function ExportDskButton(props: ExportDskButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      // 1. Générer le SCR
      const scr = generateScr({
        imageData: props.imageData,
        mode: props.mode,
      });

      // 2. Générer le code ASM pour créer le DSK
      const asmCode = generateDskCode({
        scrData: scr,
        palette: props.palette,
        screenFilename: "IMAGE.SCR",
        basicFilename: "LOADER.BAS",
      });

      // 3. Assembler avec RASM
      const result = await assemble(asmCode, {
        exportType: "dsk", // Ou géré par les directives SAVE ?
      });

      if (!result.success) {
        throw new Error(result.output);
      }

      // 4. Télécharger le DSK
      if (result.dsk) {
        downloadBinary(result.dsk, "pixsaur.dsk");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <Button onClick={handleExport} disabled={isExporting}>
        {isExporting ? "Generating DSK..." : "Export as DSK"}
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
```

### Workflow Phase 1

1. **Utilisateur convertit une image**

   - Upload → Conversion → Prévisualisation

2. **Clic sur "Export as DSK"**

   - Génération du SCR (16Ko)
   - Génération du code ASM avec directives SAVE
   - Compilation RASM → DSK
   - Téléchargement automatique

3. **Test du DSK**
   - Charger dans un émulateur CPC
   - RUN"LOADER.BAS" → affiche l'image

### TODO Phase 1

- [ ] Créer `src/libs/cpc/scr-generator.ts`
- [ ] Créer `src/libs/rasm-wasm/dsk-generator.ts`
- [ ] Créer `src/components/export-dsk/export-dsk-button.tsx`
- [ ] Générer BASIC loader avec palette
- [ ] Tester : DSK → Émulateur → Affichage correct
- [ ] Documenter le format SCR et le processus

### Phase 4 : Polish & UX

- Interface utilisateur complète
- Gestion d'erreurs robuste
- Documentation complète
- Tests end-to-end
- **Durée estimée** : 2 jours

---

## 🤔 Questions ouvertes

1. **Gestion des grandes images** : Comment gérer les images qui dépassent 16Ko de VRAM ?

   - Compression ?
   - Découpage en tuiles ?
   - Limitation de la taille d'entrée ?

2. **Formats d'image source** : Faut-il supporter d'autres formats d'entrée (PNG, BMP, etc.) ou seulement ceux déjà supportés ?

3. **Multi-écrans** : Permettre l'export de plusieurs images dans un seul DSK/SNA (slideshow) ?

4. **Démo-coding** : Ajouter des effets CPC classiques (plasma, rasters, copper bars) ?

5. **Interactivité** : Permettre de générer du code avec interactions clavier/joystick ?

---

## 📚 Références

- [Documentation RASM](https://github.com/EdouardBERGE/rasm)
- [Format SNA Amstrad CPC](http://www.cpcwiki.eu/index.php/Format:SNA_snapshot_file_format)
- [Format DSK](http://www.cpcwiki.eu/index.php/Format:DSK_disk_image_file_format)
- [CPC Screen formats](http://www.cpcwiki.eu/index.php/Video_modes)
- [CPC Palette](http://www.cpcwiki.eu/index.php/CPC_Palette)

---

**Version** : 1.0  
**Date** : 3 novembre 2025  
**Auteur** : Ivan Duchauffour + GitHub Copilot
