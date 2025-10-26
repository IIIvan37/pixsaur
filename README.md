# Pixsaur

**Image converter for Amstrad CPC** - Web and desktop application with palette quantization, dithering, and multi-format exports.

## Features

- **CPC palette quantization** : 27 colors (Classic) or 4096 colors (Plus)
- **Color spaces** : RGB, Lab, XYZ for maximum precision
- **Dithering and adjustments** : Brightness, contrast, saturation in real-time
- **Export** : scr, linear, palette, png...
- **CPU/GPU architecture** : Adaptive processing with intelligent fallback

## Installation

```bash
pnpm install
pnpm dev          # Web (http://localhost:5173)
pnpm tauri:dev    # Desktop
```

## Tech Stack

- **React 19** + TypeScript + Vite
- **Jotai** - Atomic state management
- **Tauri 2.9** - Cross-platform desktop
- **pixsaur-color** - Custom colorimetric library (Lab, XYZ, RGB)
- **Biome** - Linting and formatting

## Contribution

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details
