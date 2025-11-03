# Guide d'intégration RASM

Ce document explique comment intégrer RASM (Roudoudou's ASseMbler) dans les Netlify Functions de Pixsaur.

## Option 1: RASM compilé en WebAssembly (Recommandé)

### Avantages

- ✅ Pas de dépendances système
- ✅ Exécution rapide
- ✅ Portable (fonctionne partout où WebAssembly est supporté)
- ✅ Sandboxé (sécurité)

### Étapes

1. **Compiler RASM en WASM**

   ```bash
   # Cloner RASM
   git clone https://github.com/EdouardBERGE/rasm.git
   cd rasm

   # Compiler avec Emscripten
   emcc rasm.c -o rasm.js -s WASM=1 -s EXPORTED_FUNCTIONS='["_main"]' \
     -s EXTRA_EXPORTED_RUNTIME_METHODS='["FS","callMain"]'
   ```

2. **Intégrer dans Netlify Functions**

   ```bash
   # Copier les fichiers générés
   cp rasm.js rasm.wasm netlify/functions/lib/
   ```

3. **Utiliser dans assemble.ts**

   ```typescript
   import Module from "./lib/rasm.js";

   const rasm = await Module();
   // Utiliser l'API RASM via WASM
   ```

## Option 2: Binaire natif

### Avantages

- ✅ Simple à implémenter
- ✅ Utilise RASM officiel sans modification

### Inconvénients

- ❌ Dépend de l'architecture du serveur Netlify (x64 Linux)
- ❌ Nécessite upload du binaire
- ❌ Moins portable

### Étapes

1. **Télécharger RASM pour Linux x64**

   ```bash
   # Depuis https://github.com/EdouardBERGE/rasm/releases
   wget https://github.com/EdouardBERGE/rasm/releases/latest/download/rasm
   chmod +x rasm
   mv rasm netlify/functions/lib/
   ```

2. **Utiliser avec child_process**

   ```typescript
   import { exec } from "child_process";
   import { promisify } from "util";

   const execAsync = promisify(exec);

   // Écrire le code dans un fichier temporaire
   await fs.writeFile("/tmp/input.asm", code);

   // Exécuter RASM
   await execAsync("./lib/rasm /tmp/input.asm -o /tmp/output.bin");

   // Lire le résultat
   const binary = await fs.readFile("/tmp/output.bin");
   ```

## Option 3: Réimplémentation JavaScript

### Avantages

- ✅ Aucune dépendance externe
- ✅ Contrôle total du code
- ✅ Facile à déboguer et maintenir

### Inconvénients

- ❌ Effort de développement important
- ❌ Compatibilité limitée (syntaxe RASM partielle)
- ❌ Maintenance continue pour les nouvelles features RASM

### Fonctionnalités à implémenter

1. Parser basique Z80
2. Assembleur pour instructions communes
3. Support des directives (ORG, DB, DW, etc.)
4. Gestion des labels et symboles
5. Export DSK/SNA

## Recommandation

**Option 1 (WASM)** est la meilleure approche car elle combine:

- Performance native de RASM
- Portabilité
- Sécurité
- Pas de dépendances système

## Prochaines étapes

1. [ ] Compiler RASM en WASM avec Emscripten
2. [ ] Créer un wrapper TypeScript pour l'API WASM
3. [ ] Intégrer dans `netlify/functions/assemble.ts`
4. [ ] Tester avec des exemples de code Z80
5. [ ] Implémenter la création de DSK avec les binaires assemblés
6. [ ] Implémenter la création de SNA

## Resources

- [RASM GitHub](https://github.com/EdouardBERGE/rasm)
- [Emscripten Documentation](https://emscripten.org/docs/getting_started/downloads.html)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [Netlify Functions Node.js](https://docs.netlify.com/functions/build/?fn-language=ts)

## Exemples d'utilisation

### Assembler du code simple

```typescript
const result = await pixsaurApi.assemble({
  code: `
    ORG &4000
    LD A,1
    LD B,2
    ADD A,B
    RET
  `,
});
```

### Créer un DSK avec une image

```typescript
const result = await pixsaurApi.createDsk({
  files: [
    {
      name: "IMAGE.SCR",
      data: base64ImageData,
      type: "binary",
      loadAddress: 0xc000,
    },
    {
      name: "LOADER.BAS",
      data: base64BasicLoader,
      type: "basic",
    },
  ],
  format: "DATA",
});
```

### Créer un SNA bootable

```typescript
const result = await pixsaurApi.createSna({
  binary: base64Binary,
  loadAddress: 0x4000,
  startAddress: 0x4000,
  cpcType: "6128",
});

// Télécharger automatiquement
pixsaurApi.downloadFile(result.data!, "demo.sna", "application/octet-stream");
```
