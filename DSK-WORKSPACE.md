# DSK Workspace - Guide d'utilisation

## Vue d'ensemble

Le DSK Workspace permet de créer une disquette (DSK) contenant plusieurs images SCR converties avec Pixsaur, ainsi qu'un loader universel pour les charger facilement.

## Contenu du DSK exporté

Lorsque vous exportez un DSK depuis le workspace, celui-ci contient :

1. **LOADER.BIN** : Un loader universel qui peut charger n'importe quel fichier SCR
2. **IMG00001.SCR** : Première image convertie
3. **IMG00002.SCR** : Deuxième image convertie
4. **IMG00003.SCR** : Troisième image convertie
5. ... et ainsi de suite

## Utilisation depuis BASIC

### Charger le loader en mémoire

```basic
LOAD "LOADER.BIN"
```

Le loader est chargé à l'adresse `&4000`.

### Afficher une image

Pour afficher une image, utilisez la commande `CALL` avec le nom du fichier SCR :

```basic
CALL &4000, @"IMG00001.SCR"
```

### Exemples d'utilisation

#### Afficher une image spécifique

```basic
10 LOAD "LOADER.BIN"
20 CALL &4000, @"IMG00001.SCR"
```

#### Diaporama automatique

```basic
10 LOAD "LOADER.BIN"
20 FOR i=1 TO 5
30   f$="IMG"+RIGHT$("0000"+STR$(i),5)+".SCR"
40   CALL &4000, @f$
50   CALL &BD19  ' Wait for key press
60 NEXT i
```

#### Menu de sélection

```basic
10 LOAD "LOADER.BIN"
20 PRINT "Choisissez une image (1-5):"
30 INPUT n
40 IF n<1 OR n>5 THEN GOTO 20
50 f$="IMG"+RIGHT$("0000"+STR$(n),5)+".SCR"
60 CALL &4000, @f$
```

## Fonctionnement du loader

Le loader universel :

1. **Accepte le nom du fichier en paramètre** depuis BASIC
2. **Charge automatiquement le fichier SCR** depuis la disquette
3. **Détecte et applique le mode graphique** (Mode 0 par défaut)
4. **Configure la palette** à partir des données du fichier SCR
5. **Affiche l'image** à l'écran

### Données de palette dans les fichiers SCR

Chaque fichier SCR contient les données de palette à l'offset 2000 :
- **Offset 2000** : Couleur de la bordure
- **Offset 2001-2016** : Palette firmware (16 couleurs)
- **Offset 2017-2033** : Palette hardware

Le loader lit automatiquement ces données et configure le CPC en conséquence.

## Format des noms de fichiers

Les fichiers SCR suivent le format AMSDOS 8.3 :
- **8 caractères maximum** pour le nom
- **3 caractères** pour l'extension
- **Majuscules uniquement** (A-Z, 0-9, underscore)

Exemples valides :
- `IMG00001.SCR`
- `IMAGE_01.SCR`
- `SCREEN01.SCR`

## Limitations

- Le loader fonctionne actuellement en **Mode 0** (16 couleurs) par défaut
- Taille maximale par fichier SCR : **16KB + palette** (~16.4KB)
- La disquette peut contenir environ **11 images** (capacité ~178KB)

## Avantages de cette approche

✅ **Un seul loader pour toutes les images** : Pas besoin de loader différent par image  
✅ **Flexible** : Chargez n'importe quelle image dans n'importe quel ordre  
✅ **Simple** : Une seule commande `CALL` pour afficher une image  
✅ **Efficace** : Le loader reste en mémoire, pas besoin de le recharger  
✅ **Programmable** : Créez vos propres diaporamas et menus en BASIC

## Astuces

### Précharger plusieurs images

```basic
10 LOAD "LOADER.BIN"
20 DIM images$(5)
30 FOR i=1 TO 5
40   images$(i)="IMG"+RIGHT$("0000"+STR$(i),5)+".SCR"
50 NEXT i
60 ' Maintenant vous pouvez afficher n'importe quelle image :
70 CALL &4000, @images$(1)
```

### Animation simple

```basic
10 LOAD "LOADER.BIN"
20 FOR frame=1 TO 10
30   f$="IMG"+RIGHT$("0000"+STR$(frame),5)+".SCR"
40   CALL &4000, @f$
50   FOR delay=1 TO 100: NEXT delay  ' Pause
60 NEXT frame
```

## Support

Pour plus d'informations sur Pixsaur et la conversion d'images CPC :
- GitHub : https://github.com/IIIvan37/pixsaur
- Documentation : [README.md](../README.md)
