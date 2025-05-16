import { i18n } from '@lingui/core'
import { en, fr } from 'make-plural/plurals'

// Définir les messages directement dans le code
const messages = {
  fr: {
    'Image Source': 'Image Source',
    Aperçu: 'Aperçu',
    Mode: 'Mode',
    Tramage: 'Tramage',
    "Ajustements d'image": "Ajustements d'image",
    Rouge: 'Rouge',
    Vert: 'Vert',
    Bleu: 'Bleu',
    Luminosité: 'Luminosité',
    Contraste: 'Contraste',
    Saturation: 'Saturation',
    Exporter: 'Exporter',
    'Exporter en PNG': 'Exporter en PNG',
    Raccourcis: 'Raccourcis',
    "Convertisseur d'images Amstrad CPC": "Convertisseur d'images Amstrad CPC",
    "Changer d'image": "Changer d'image",
    Réinitialiser: 'Réinitialiser',
    'Réinitialiser les ajustements': 'Réinitialiser les ajustements',
    'Raccourcis clavier': 'Raccourcis clavier',
    'Ouvrir une image': 'Ouvrir une image',
    'Passer en Mode 0': 'Passer en Mode 0',
    'Passer en Mode 1': 'Passer en Mode 1',
    'Passer en Mode 2': 'Passer en Mode 2',
    'Afficher/masquer les raccourcis': 'Afficher/masquer les raccourcis',
    "Cliquez n'importe où pour fermer": "Cliquez n'importe où pour fermer",
    'Glissez & déposez une image ici': 'Glissez & déposez une image ici',
    'ou cliquez pour sélectionner un fichier':
      'ou cliquez pour sélectionner un fichier',
    'Formats supportés: PNG, JPG, GIF, BMP':
      'Formats supportés: PNG, JPG, GIF, BMP',
    'Aucune image traitée': 'Aucune image traitée',
    'Traitement...': 'Traitement...'
  },
  en: {
    'Image Source': 'Image Source',
    Aperçu: 'Preview',
    Mode: 'Mode',
    Tramage: 'Dithering',
    "Ajustements d'image": 'Image Adjustments',
    Rouge: 'Red',
    Vert: 'Green',
    Bleu: 'Blue',
    Luminosité: 'Brightness',
    Contraste: 'Contrast',
    Saturation: 'Saturation',
    Exporter: 'Export',
    'Exporter en PNG': 'Export as PNG',
    Raccourcis: 'Shortcuts',
    "Convertisseur d'images Amstrad CPC": 'Amstrad CPC Image Converter',
    "Changer d'image": 'Change Image',
    Réinitialiser: 'Reset',
    'Réinitialiser les ajustements': 'Reset Adjustments',
    'Raccourcis clavier': 'Keyboard Shortcuts',
    'Ouvrir une image': 'Open an image',
    'Passer en Mode 0': 'Switch to Mode 0',
    'Passer en Mode 1': 'Switch to Mode 1',
    'Passer en Mode 2': 'Switch to Mode 2',
    'Afficher/masquer les raccourcis': 'Show/hide shortcuts',
    "Cliquez n'importe où pour fermer": 'Click anywhere to close',
    'Glissez & déposez une image ici': 'Drag & drop an image here',
    'ou cliquez pour sélectionner un fichier': 'or click to select a file',
    'Formats supportés: PNG, JPG, GIF, BMP':
      'Supported formats: PNG, JPG, GIF, BMP',
    'Aucune image traitée': 'No processed image',
    'Traitement...': 'Processing...'
  }
}

// Définir les pluriels pour chaque langue
i18n.loadLocaleData({
  en: { plurals: en },
  fr: { plurals: fr }
})

export { i18n }
