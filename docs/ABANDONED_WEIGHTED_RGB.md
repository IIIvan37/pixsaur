# Feature Abandonnée : Distance RGB Pondérée

**Date** : 23 octobre 2025  
**Statut** : ❌ Abandonnée  
**Raison** : Complexité technique > Valeur utilisateur

## Résumé

Tentative d'implémentation d'une distance RGB pondérée perceptuelle (ITU-R BT.601) pour améliorer la qualité de quantification des couleurs.

**Blocages découverts** :
1. **Diversity Mode** : Le quantizer CPC utilise un mode diversité (8-16 couleurs) qui **ignore complètement** la distance metric
2. **Architecture GPU** : ReGL fait la quantification sur GPU (WebGL) - nécessiterait implémentation GLSL shader
3. **Palette limitée** : 27 couleurs CPC trop contraintes pour voir amélioration perceptuelle

**Temps investi** : ~4h dev + analysis  
**Valeur obtenue** : 0 (aucun effet visible)

**Code préservé** :
- ✅ `weightedRGBDistance()` function dans `distance.ts` (peut servir futur)
- ✅ Type `'weighted-rgb'` dans registry (cohérence)

**Code supprimé** :
- ❌ UI toggle Switch dans `preview-panel.tsx`
- ❌ `useWeightedRGBAtom` dans `config.ts`
- ❌ Integration dans `preview.ts` et `regl-processor.ts`
- ❌ i18n entries (4 langues)

## Documentation Complète

Voir [WEIGHTED_RGB_DISTANCE_ANALYSIS.md](./abandoned-features/WEIGHTED_RGB_DISTANCE_ANALYSIS.md) pour analyse technique détaillée.

## Leçons

- **Quick Win ≠ UI simple** : Complexité cachée dans diversity mode + GPU
- **Vérifier impact réel** : Diversity mode bypass invalidait toute l'approche
- **GPU = autre niveau** : Modifications nécessitent shaders GLSL, pas juste JS

## Conclusion

Feature abandonnée car nécessite 5-7 jours dev (GPU shader + diversity rewrite) pour bénéfice perceptuel marginal sur palette 27 couleurs.

---

*Branche feature/weighted-rgb-distance à supprimer après commit de cette documentation.*
