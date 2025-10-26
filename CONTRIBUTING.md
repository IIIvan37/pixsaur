# Contributing to Pixsaur

Thank you for your interest in contributing to Pixsaur! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

- 🐛 **Report bugs** via [GitHub Issues](https://github.com/IIIvan37/pixsaur/issues)
- 💡 **Suggest features** through [GitHub Discussions](https://github.com/IIIvan37/pixsaur/discussions)
- 📝 **Improve documentation** in `/docs` or code comments
- 🔧 **Submit pull requests** for bug fixes or new features
- 🌍 **Add translations** for i18n support (currently: en, fr, de, es)
- 🎨 **Contribute UI/UX improvements**

## 📋 Before You Start

### Read the Documentation

1. **[QUICK_START_GUIDE.md](./docs/QUICK_START_GUIDE.md)** - Commands and quick references
2. **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - Architecture and patterns
3. **[copilot-instructions.md](./.github/copilot-instructions.md)** - Core patterns and constraints
4. **[DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md)** - Full documentation index

### Development Setup

```bash
# Clone the repository
git clone https://github.com/IIIvan37/pixsaur.git
cd pixsaur

# Install dependencies
pnpm install

# Start development server (web)
pnpm dev

# Start development server (desktop)
pnpm tauri:dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm biome:check
```

## 🔀 Pull Request Process

### 1. Fork and Branch

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/pixsaur.git
cd pixsaur

# Add upstream remote
git remote add upstream https://github.com/IIIvan37/pixsaur.git

# Create a feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Follow these guidelines:

#### Code Standards

✅ **Do:**
- Use TypeScript strict mode
- Follow existing patterns (see `.github/copilot-instructions.md`)
- Write tests for new features (`.spec.tsx` co-located)
- Use CSS Modules for styling
- Use Jotai atoms (no prop drilling)
- Keep functions pure and testable
- Add JSDoc comments for public APIs
- Use RefObject pattern for refs

❌ **Don't:**
- Mutate props or state directly
- Use `any` type without justification
- Add console.log in production code (use logger utility)
- Create unnecessary atoms
- Break CPC constraints (RGB [0, 128, 255])

#### File Organization

```
src/
├── components/
│   └── feature-name/
│       ├── feature-name.tsx        # Main component
│       ├── feature-name-view.tsx   # Presentation (if needed)
│       ├── feature-name.spec.tsx   # Tests
│       └── feature-name.module.css # Styles
├── app/store/
│   └── feature/
│       ├── feature.ts              # Atoms
│       └── feature.spec.ts         # Tests
└── utils/
    └── feature/
        ├── feature.ts
        └── feature.spec.ts
```

#### Commit Messages

Use conventional commits:

```
feat: add export to DSK format
fix: correct CPC Plus palette quantization
docs: update CONTRIBUTING guide
chore: update dependencies
refactor: simplify quantizer factory
test: add tests for locked colors
style: format with Biome
```

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Type check
pnpm typecheck

# Lint check
pnpm biome:check

# Lint fix
pnpm biome:check --write

# Build (ensure no errors)
pnpm build

# Test desktop build
pnpm tauri:build
```

### 4. Submit Pull Request

```bash
# Update from upstream
git fetch upstream
git rebase upstream/main

# Push to your fork
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- **Clear title** describing the change
- **Description** explaining what, why, and how
- **Screenshots** for UI changes
- **Related issues** (if any): "Fixes #123"
- **Test results** (all passing)

## 🎯 Priority Areas

Looking for where to contribute? Check these areas:

### 🟢 Good First Issues

- Distance RGB pondérée (weighted RGB distance)
- Lissage horizontal anti-aliasing
- Tri de palette par fréquence
- Additional export formats (CMP, IMP, Tiles)
- UI translations

### 🟡 Intermediate

- ReGL GPU quantizer (Lab/XYZ support)
- Custom dithering patterns
- Animation/sprite handling
- Web Workers for threading
- Batch processing

### 🔴 Advanced

- Compression algorithms (ZX0, ZX1)
- DSK image format complete implementation
- Performance optimizations
- Memory management for large images

See [README Roadmap](./README.md#-roadmap) for full list.

## 🐛 Bug Reports

### Before Reporting

1. Search [existing issues](https://github.com/IIIvan37/pixsaur/issues)
2. Test on latest version
3. Check if it's a known limitation (see docs)

### Issue Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Upload image '...'
2. Set palette to '...'
3. Click export '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- Browser: [e.g., Chrome 120, Firefox 122] OR Tauri desktop
- Pixsaur version: [e.g., 0.1.0]

**Additional context**
- Image size/format
- Selected settings
- Console errors (F12)
```

## 💡 Feature Requests

Use [GitHub Discussions](https://github.com/IIIvan37/pixsaur/discussions) for:
- New feature ideas
- Architecture proposals
- Performance improvements
- UI/UX suggestions

Include:
- **Use case**: Why is this needed?
- **Proposal**: How should it work?
- **Alternatives**: Other solutions considered?
- **Impact**: Who benefits?

## 🌍 Translation Contributions

Pixsaur uses [Lingui](https://lingui.dev/) for i18n. See [I18N_GUIDE.md](./docs/I18N_GUIDE.md) for details.

### Adding a New Language

1. Add language to `lingui.config.js`
2. Extract messages: `pnpm lingui:extract`
3. Translate in `src/locales/<lang>/messages.po`
4. Compile: `pnpm lingui:compile`
5. Add language selector option

### Improving Translations

1. Edit `src/locales/<lang>/messages.po`
2. Compile: `pnpm lingui:compile`
3. Test in app

## 📚 Documentation Contributions

Documentation is as important as code!

### Types of Documentation

- **README.md**: Overview and quick start
- **docs/**: Technical guides and architecture
- **Code comments**: JSDoc for public APIs
- **CHANGELOG.md**: Version history *(to create)*

### Documentation Standards

- Clear, concise English (or French for certain docs)
- Code examples when relevant
- Screenshots for UI features
- Links to related docs
- Keep up to date with code changes

## 🧪 Testing Guidelines

### What to Test

- ✅ New features (unit + integration)
- ✅ Bug fixes (regression tests)
- ✅ Edge cases (empty input, large files, etc.)
- ✅ CPC constraints (dimensions, memory, palette)

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from './my-function'

describe('myFunction', () => {
  it('should handle normal case', () => {
    const result = myFunction(validInput)
    expect(result).toBe(expectedOutput)
  })

  it('should handle edge case', () => {
    const result = myFunction(edgeCase)
    expect(result).toBe(expectedEdgeOutput)
  })

  it('should throw on invalid input', () => {
    expect(() => myFunction(invalidInput)).toThrow()
  })
})
```

## 🚀 Release Process

*(For maintainers)*

1. Update version in `package.json` and `src-tauri/tauri.conf.json`
2. Update `CHANGELOG.md` *(to create)*
3. Create git tag: `git tag -a v0.1.0 -m "Release v0.1.0"`
4. Push tag: `git push origin v0.1.0`
5. GitHub Actions will build and create release
6. Add release notes on GitHub

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

**Positive behavior:**
- ✅ Being respectful and inclusive
- ✅ Gracefully accepting constructive criticism
- ✅ Focusing on what's best for the community
- ✅ Showing empathy towards others

**Unacceptable behavior:**
- ❌ Harassment, discrimination, or offensive comments
- ❌ Trolling or insulting/derogatory comments
- ❌ Public or private harassment
- ❌ Publishing others' private information

### Enforcement

Instances of unacceptable behavior may be reported to project maintainers. All complaints will be reviewed and investigated promptly and fairly.

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/IIIvan37/pixsaur/issues)
- **Discussions**: [GitHub Discussions](https://github.com/IIIvan37/pixsaur/discussions)
- **Security**: Report security vulnerabilities privately via GitHub Security

## 📝 License

By contributing to Pixsaur, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Pixsaur! 🦖**

Every contribution, no matter how small, helps make Pixsaur better for the Amstrad CPC community.
