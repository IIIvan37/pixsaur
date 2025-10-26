# Contributing to Pixsaur

Thank you for your interest in contributing to Pixsaur! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## How to Contribute

### Reporting Bugs

Open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (browser, OS, version)

### Suggesting Features

Open an issue with:
- Clear use case description
- Proposed solution or approach
- Potential alternatives considered

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following our code standards
4. Test your changes: `pnpm test && pnpm typecheck`
5. Commit with clear messages
6. Push and create a Pull Request

## Development Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm biome check .
```

## Code Standards

- **TypeScript**: Strict mode enabled
- **Formatting**: Use Biome (`pnpm biome format --write .`)
- **Linting**: No errors or warnings (`pnpm biome check .`)
- **Tests**: Add tests for new features
- **Commits**: Use conventional commit messages

## Project Structure

```
src/
├── app/              # Application root and providers
├── components/       # React components
├── hooks/            # Custom React hooks
├── libs/             # Core libraries (color, adapters)
├── locales/          # i18n translations
├── palettes/         # CPC color palettes
├── styles/           # CSS modules
└── utils/            # Utility functions
```

## Testing

- Write unit tests for utilities and hooks
- Test components with user interactions
- Ensure all tests pass before submitting PR

## Questions?

Open a discussion or issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
