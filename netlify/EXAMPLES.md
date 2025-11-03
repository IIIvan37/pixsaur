# Exemples d'utilisation des Netlify Functions

Ce document contient des exemples pratiques d'utilisation de l'API Pixsaur.

## 1. Export d'une image en DSK avec loader BASIC

```typescript
import { pixsaurApi } from "@/libs/api-client";

async function exportImageAsDsk(scrData: Uint8Array) {
  // Convertir l'image SCR en base64
  const imageBase64 = pixsaurApi.arrayBufferToBase64(scrData);

  // Créer un loader BASIC simple
  const basicLoader = `
10 MODE 0
20 LOAD "IMAGE.SCR",&C000
30 CALL &BC02
  `.trim();

  const loaderBase64 = btoa(basicLoader);

  // Créer le DSK
  const result = await pixsaurApi.createDsk({
    files: [
      {
        name: "IMAGE.SCR",
        data: imageBase64,
        type: "binary",
        loadAddress: 0xc000,
      },
      {
        name: "LOADER.BAS",
        data: loaderBase64,
        type: "basic",
      },
    ],
    format: "DATA",
    diskName: "PIXSAUR",
  });

  if (result.success && result.data) {
    pixsaurApi.downloadFile(
      result.data,
      "image.dsk",
      "application/octet-stream"
    );
  }
}
```

## 2. Créer un SNA avec effet CRT

```typescript
async function exportAsSnapshotWithEffect(
  imageData: Uint8Array,
  crtEffect: boolean = true
) {
  // Générer le code assembleur pour l'affichage
  const asmCode = `
    ORG &4000
    
    ; Copier l'image depuis &8000 vers &C000
    LD HL,&8000
    LD DE,&C000
    LD BC,&4000
    LDIR
    
    ${
      crtEffect
        ? `
    ; Appliquer effet CRT (scanlines)
    LD HL,&C000
    LD DE,&4000
.scanline_loop
    LD A,(HL)
    AND &AA        ; Masque pour scanlines
    LD (HL),A
    INC HL
    DEC DE
    LD A,D
    OR E
    JR NZ,.scanline_loop
    `
        : ""
    }
    
    ; Boucle infinie
.loop
    JR .loop
  `;

  // Assembler le code
  const assembled = await pixsaurApi.assemble({
    code: asmCode,
  });

  if (!assembled.success || !assembled.binary) {
    throw new Error("Assembly failed");
  }

  // Créer le snapshot
  const result = await pixsaurApi.createSna({
    binary: assembled.binary,
    loadAddress: 0x4000,
    startAddress: 0x4000,
    cpcType: "6128",
  });

  if (result.success && result.data) {
    pixsaurApi.downloadFile(
      result.data,
      "demo.sna",
      "application/octet-stream"
    );
  }
}
```

## 3. Export batch de plusieurs images

```typescript
async function exportMultipleImagesAsDsk(
  images: Array<{
    name: string;
    data: Uint8Array;
  }>
) {
  const files = images.map((img, index) => ({
    name: `IMG${index.toString().padStart(2, "0")}.SCR`,
    data: pixsaurApi.arrayBufferToBase64(img.data),
    type: "binary" as const,
    loadAddress: 0xc000,
  }));

  // Ajouter un menu de sélection en BASIC
  const menuBasic = `
10 MODE 0
20 CLS
30 PRINT "Image Gallery"
40 PRINT "=============="
50 PRINT
${images
  .map((_, i) => `${60 + i * 10} PRINT "${i + 1}. ${images[i].name}"`)
  .join("\n")}
${100 + images.length * 10} INPUT "Select image: ",N
${110 + images.length * 10} IF N<1 OR N>${images.length} THEN GOTO ${
    100 + images.length * 10
  }
${120 + images.length * 10} LOAD "IMG"+RIGHT$("0"+STR$(N-1),2)+".SCR",&C000
${130 + images.length * 10} CALL &BC02
${140 + images.length * 10} GOTO 20
  `.trim();

  files.push({
    name: "MENU.BAS",
    data: btoa(menuBasic),
    type: "basic",
  });

  const result = await pixsaurApi.createDsk({
    files,
    format: "EXTENDED", // Extended pour plus d'espace
    diskName: "GALLERY",
  });

  if (result.success && result.data) {
    pixsaurApi.downloadFile(
      result.data,
      "gallery.dsk",
      "application/octet-stream"
    );
  }
}
```

## 4. Génération de sprite animé

```typescript
async function createAnimatedSpriteDsk(frames: Uint8Array[]) {
  const spriteCode = `
    ORG &4000
    
    ; Initialisation
    LD IX,sprite_data
    LD B,${frames.length}  ; Nombre de frames
    
.animation_loop
    PUSH BC
    
    ; Afficher la frame courante
    LD L,(IX+0)
    LD H,(IX+1)
    LD DE,&C000
    LD BC,&4000
    LDIR
    
    ; Délai
    LD BC,&FFFF
.delay
    DEC BC
    LD A,B
    OR C
    JR NZ,.delay
    
    ; Frame suivante
    INC IX
    INC IX
    
    POP BC
    DJNZ .animation_loop
    
    JP &4000  ; Recommencer
    
sprite_data:
${frames.map((_, i) => `    DW sprite_frame_${i}`).join("\n")}

${frames
  .map(
    (_, i) => `
sprite_frame_${i}:
    INCBIN "FRAME${i.toString().padStart(2, "0")}.BIN"
`
  )
  .join("\n")}
  `;

  // Assembler
  const assembled = await pixsaurApi.assemble({
    code: spriteCode,
  });

  // Créer les fichiers binaires
  const files = frames.map((frame, i) => ({
    name: `FRAME${i.toString().padStart(2, "0")}.BIN`,
    data: pixsaurApi.arrayBufferToBase64(frame),
    type: "binary" as const,
  }));

  if (assembled.success && assembled.binary) {
    files.push({
      name: "ANIM.BIN",
      data: assembled.binary,
      type: "binary",
    });
  }

  const result = await pixsaurApi.createDsk({
    files,
    format: "EXTENDED",
  });

  if (result.success && result.data) {
    pixsaurApi.downloadFile(
      result.data,
      "animation.dsk",
      "application/octet-stream"
    );
  }
}
```

## 5. Hook dans un composant React

```typescript
import { useState } from "react";
import { pixsaurApi } from "@/libs/api-client";
import { useImageStore } from "@/store/image-store";

export function useAdvancedExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageData = useImageStore((state) => state.processedImage);

  const exportAsDsk = async () => {
    if (!imageData) {
      setError("No image loaded");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await pixsaurApi.createDsk({
        files: [
          {
            name: "IMAGE.SCR",
            data: pixsaurApi.arrayBufferToBase64(imageData),
            type: "binary",
            loadAddress: 0xc000,
          },
        ],
        format: "DATA",
      });

      if (result.success && result.data) {
        pixsaurApi.downloadFile(
          result.data,
          "export.dsk",
          "application/octet-stream"
        );
      } else {
        setError(result.message || "Export failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const exportAsSna = async () => {
    if (!imageData) {
      setError("No image loaded");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await pixsaurApi.createSna({
        binary: pixsaurApi.arrayBufferToBase64(imageData),
        loadAddress: 0xc000,
        startAddress: 0xc000,
        cpcType: "6128",
      });

      if (result.success && result.data) {
        pixsaurApi.downloadFile(
          result.data,
          "export.sna",
          "application/octet-stream"
        );
      } else {
        setError(result.message || "Export failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return {
    exportAsDsk,
    exportAsSna,
    loading,
    error,
  };
}
```

## 6. Tester l'API en ligne de commande

```bash
# Tester l'endpoint health
curl https://pixsaur.iiivan.org/.netlify/functions/health

# Assembler du code Z80
curl -X POST https://pixsaur.iiivan.org/.netlify/functions/assemble \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ORG &4000\nLD A,1\nRET"
  }'

# Créer un DSK
curl -X POST https://pixsaur.iiivan.org/.netlify/functions/create-dsk \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "name": "TEST.BIN",
      "data": "SGVsbG8gQ1BD",
      "type": "binary"
    }],
    "format": "DATA"
  }' \
  --output test.dsk

# Créer un SNA
curl -X POST https://pixsaur.iiivan.org/.netlify/functions/create-sna \
  -H "Content-Type: application/json" \
  -d '{
    "binary": "MQICAwM=",
    "loadAddress": 16384,
    "startAddress": 16384
  }' \
  --output test.sna
```

## Notes

- Tous les exemples utilisent base64 pour encoder les données binaires
- Les adresses sont en hexadécimal (préfixe 0x en JS/TS, & en assembleur Z80)
- Le format DSK DATA supporte ~180KB, EXTENDED jusqu'à 800KB
- Le format SNA v3 capture l'état complet du CPC (64KB RAM + registres)
