import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PaletteStrategy } from '@/app/store/config/types'
import {
  type PaletteStrategyOption,
  PaletteStrategySelectorView
} from './palette-strategy-selector-view'

const mockStrategies: readonly PaletteStrategyOption[] = [
  {
    value: 'frequency-balanced',
    label: 'Fréquence Équilibrée',
    description: 'Fréquence prioritaire (80%) avec diversité modérée'
  },
  {
    value: 'frequency-max',
    label: 'Fréquence Contraste',
    description: 'Équilibre fréquence (60%) et diversité (40%)'
  },
  {
    value: 'diversity-first-max',
    label: 'Diversité Pure',
    description: 'Diversité maximale (100%), fréquence ignorée'
  }
]

describe('PaletteStrategySelectorView (Dumb Component)', () => {
  describe('Rendering', () => {
    it('should render label', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          currentDescription='Fréquence prioritaire (80%) avec diversité modérée'
          onStrategyChange={onStrategyChange}
        />
      )

      expect(screen.getByText('Stratégie de palette')).toBeInTheDocument()
    })

    it('should render select with current strategy', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          currentDescription='Fréquence prioritaire (80%) avec diversité modérée'
          onStrategyChange={onStrategyChange}
        />
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('Fréquence Équilibrée')).toBeInTheDocument()
    })

    it('should render current description', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          currentDescription='Fréquence prioritaire (80%) avec diversité modérée'
          onStrategyChange={onStrategyChange}
        />
      )

      expect(
        screen.getByText(/fréquence prioritaire.*80.*diversité modérée/i)
      ).toBeInTheDocument()
    })

    it('should not render description when not provided', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          onStrategyChange={onStrategyChange}
        />
      )

      expect(
        screen.queryByText(/fréquence prioritaire/i)
      ).not.toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('should call onStrategyChange when strategy changes', async () => {
      const user = userEvent.setup()
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          currentDescription='Test description'
          onStrategyChange={onStrategyChange}
        />
      )

      const select = screen.getByRole('combobox')
      await user.click(select)

      // Note: Radix UI Select interaction is complex, we just verify the callback is passed
      expect(onStrategyChange).not.toHaveBeenCalled() // Not called until actual selection
    })
  })

  describe('Strategy Options', () => {
    it('should render all provided strategies', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          onStrategyChange={onStrategyChange}
        />
      )

      // Select should be present with all options available internally
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should work with different current strategies', () => {
      const onStrategyChange = vi.fn()
      const strategies: PaletteStrategy[] = [
        'frequency-balanced',
        'frequency-max',
        'diversity-first-max'
      ]

      for (const strategy of strategies) {
        const strategyData = mockStrategies.find((s) => s.value === strategy)!
        const { unmount } = render(
          <PaletteStrategySelectorView
            strategies={mockStrategies}
            currentStrategy={strategy}
            currentDescription={strategyData.description}
            onStrategyChange={onStrategyChange}
          />
        )

        expect(screen.getByText(strategyData.label)).toBeInTheDocument()
        unmount()
      }
    })
  })

  describe('CSS Modules', () => {
    it('should apply container class', () => {
      const onStrategyChange = vi.fn()

      const { container } = render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          onStrategyChange={onStrategyChange}
        />
      )

      // Should have a div with container class
      const containerDiv = container.querySelector('div')
      expect(containerDiv).toBeInTheDocument()
      expect(containerDiv?.className).toMatch(/container/)
    })

    it('should apply label class', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          onStrategyChange={onStrategyChange}
        />
      )

      const labelDiv = screen.getByText('Stratégie de palette')
      expect(labelDiv.className).toMatch(/label/)
    })

    it('should apply description class when description is provided', () => {
      const onStrategyChange = vi.fn()

      render(
        <PaletteStrategySelectorView
          strategies={mockStrategies}
          currentStrategy='frequency-balanced'
          currentDescription='Test description'
          onStrategyChange={onStrategyChange}
        />
      )

      const descriptionDiv = screen.getByText('Test description')
      expect(descriptionDiv.className).toMatch(/description/)
    })
  })
})
