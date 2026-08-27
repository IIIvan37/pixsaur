import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { useMemo } from 'react'
import { describe, expect, it } from 'vitest'
import { paletteStrategyAtom, pixelModeAtom } from '@/app/store/config/config'
import type { PaletteStrategy } from '@/app/store/config/types'
import { PaletteStrategySelector } from './palette-strategy-selector'

// Provider avec hydratation des atoms
function TestProvider({
  children,
  initialStrategy = 'frequency-balanced' as PaletteStrategy,
  pixelMode = 1 // 1 = Mode 1 (4 colors), 0 = Mode 0 (16 colors), 2 = Mode 2 (2 colors)
}: {
  children: React.ReactNode
  initialStrategy?: PaletteStrategy
  pixelMode?: 0 | 1 | 2
}) {
  // Built once per mount: a store created on every render would drop the atom
  // values on the first re-render.
  const store = useMemo(() => {
    const created = createStore()
    created.set(paletteStrategyAtom, initialStrategy)
    created.set(pixelModeAtom, pixelMode)
    return created
  }, [initialStrategy, pixelMode])

  return <Provider store={store}>{children}</Provider>
}

describe('PaletteStrategySelector', () => {
  describe('Visibility', () => {
    it('should be visible when nColors < 16 (mode 1 = 4 colors)', () => {
      render(
        <TestProvider pixelMode={1}>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should be hidden when nColors >= 16 (mode 0 = 16 colors)', () => {
      render(
        <TestProvider pixelMode={0}>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('should be visible for mode 1 (4 colors)', () => {
      render(
        <TestProvider pixelMode={1}>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should be visible for mode 2 (2 colors)', () => {
      render(
        <TestProvider pixelMode={2}>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('Strategy selection', () => {
    it('should display component with default strategy', () => {
      render(
        <TestProvider>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Fréquence Équilibrée')).toBeInTheDocument()
    })

    it('should show frequency-balanced description as default', () => {
      render(
        <TestProvider initialStrategy='frequency-balanced'>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(
        screen.getByText(/fréquence prioritaire.*80.*diversité modérée/i)
      ).toBeInTheDocument()
    })

    it('should display description for diversity-first-max', () => {
      render(
        <TestProvider initialStrategy='diversity-first-max'>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(
        screen.getByText(/diversité maximale.*100.*fréquence ignorée/i)
      ).toBeInTheDocument()
    })

    it('should display description for balanced-score-balanced', () => {
      render(
        <TestProvider initialStrategy='balanced-score-balanced'>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(
        screen.getByText(
          /multi-critères équilibrés.*50.*freq.*25.*div.*25.*lum/i
        )
      ).toBeInTheDocument()
    })
  })

  describe('Rendering', () => {
    it('should render with Radix Select component', () => {
      render(
        <TestProvider>
          <PaletteStrategySelector />
        </TestProvider>
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      expect(select).toHaveAttribute('data-state', 'closed')
    })

    it('should render with default strategy label', () => {
      render(
        <TestProvider>
          <PaletteStrategySelector />
        </TestProvider>
      )

      expect(screen.getByText('Fréquence Équilibrée')).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work with different initial strategies', () => {
      const strategiesWithLabels: Array<{
        strategy: PaletteStrategy
        label: string
      }> = [
        { strategy: 'frequency-balanced', label: 'Fréquence Équilibrée' },
        { strategy: 'frequency-max', label: 'Fréquence Contraste' },
        { strategy: 'balanced-score-balanced', label: 'Score Équilibré' },
        { strategy: 'balanced-score-max', label: 'Score Contraste Max' },
        { strategy: 'perceptual-balanced', label: 'Perceptuel Équilibré' },
        { strategy: 'perceptual-max', label: 'Perceptuel Contraste' },
        { strategy: 'diversity-first-balanced', label: 'Diversité Équilibrée' },
        { strategy: 'diversity-first-max', label: 'Diversité Pure' },
        { strategy: 'adaptive', label: 'Adaptatif' }
      ]

      for (const { strategy, label } of strategiesWithLabels) {
        const { unmount } = render(
          <TestProvider initialStrategy={strategy}>
            <PaletteStrategySelector />
          </TestProvider>
        )

        expect(screen.getByText(label)).toBeInTheDocument()

        unmount()
      }
    })
  })
})
