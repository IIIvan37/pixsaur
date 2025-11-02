import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProcessorSelectorView } from './processor-selector-view'

describe('ProcessorSelectorView', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe('Rendering', () => {
    it('should render all three processor options', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByLabelText(/auto/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/cpu/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/gpu/i)).toBeInTheDocument()
    })

    it('should display label "Processeur:"', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByText('Processeur:')).toBeInTheDocument()
    })
  })

  describe('Auto option', () => {
    it('should check auto option when value is "auto"', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const autoRadio = screen.getByRole('radio', { name: /auto/i })
      expect(autoRadio).toBeChecked()
    })

    it('should show "CPU uniquement" when WebGL is not available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      expect(screen.getByText(/cpu uniquement/i)).toBeInTheDocument()
    })

    it('should not show "CPU uniquement" when WebGL is available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.queryByText(/cpu uniquement/i)).not.toBeInTheDocument()
    })

    it('should call onChange with "auto" when clicked', async () => {
      const user = userEvent.setup()
      render(
        <ProcessorSelectorView
          value='cpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const autoRadio = screen.getByRole('radio', { name: /auto/i })
      await user.click(autoRadio)

      expect(mockOnChange).toHaveBeenCalledWith('auto')
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('CPU option', () => {
    it('should check CPU option when value is "cpu"', () => {
      render(
        <ProcessorSelectorView
          value='cpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const cpuRadio = screen.getByRole('radio', { name: /^cpu$/i })
      expect(cpuRadio).toBeChecked()
    })

    it('should call onChange with "cpu" when clicked', async () => {
      const user = userEvent.setup()
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const cpuRadio = screen.getByRole('radio', { name: /^cpu$/i })
      await user.click(cpuRadio)

      expect(mockOnChange).toHaveBeenCalledWith('cpu')
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    it('should be always enabled regardless of WebGL availability', () => {
      const { rerender } = render(
        <ProcessorSelectorView
          value='cpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      let cpuRadio = screen.getByRole('radio', { name: /^cpu$/i })
      expect(cpuRadio).not.toBeDisabled()

      rerender(
        <ProcessorSelectorView
          value='cpu'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      cpuRadio = screen.getByRole('radio', { name: /^cpu$/i })
      expect(cpuRadio).not.toBeDisabled()
    })
  })

  describe('GPU option', () => {
    it('should check GPU option when value is "gpu"', () => {
      render(
        <ProcessorSelectorView
          value='gpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const gpuRadio = screen.getByRole('radio', { name: /gpu/i })
      expect(gpuRadio).toBeChecked()
    })

    it('should be enabled when WebGL is available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const gpuRadio = screen.getByRole('radio', { name: /gpu/i })
      expect(gpuRadio).not.toBeDisabled()
    })

    it('should be disabled when WebGL is not available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      const gpuRadio = screen.getByRole('radio', { name: /gpu/i })
      expect(gpuRadio).toBeDisabled()
    })

    it('should show "Non disponible" when WebGL is not available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      expect(screen.getByText(/non disponible/i)).toBeInTheDocument()
    })

    it('should not show "Non disponible" when WebGL is available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.queryByText(/non disponible/i)).not.toBeInTheDocument()
    })

    it('should call onChange with "gpu" when clicked and WebGL is available', async () => {
      const user = userEvent.setup()
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const gpuRadio = screen.getByRole('radio', { name: /gpu/i })
      await user.click(gpuRadio)

      expect(mockOnChange).toHaveBeenCalledWith('gpu')
      expect(mockOnChange).toHaveBeenCalledTimes(1)
    })

    it('should not call onChange when clicked and WebGL is not available', async () => {
      const user = userEvent.setup()
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      const gpuRadio = screen.getByRole('radio', { name: /gpu/i })
      await user.click(gpuRadio)

      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should apply disabled style when WebGL is not available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={false}
        />
      )

      const gpuLabel = screen
        .getByRole('radio', { name: /gpu/i })
        .closest('label')
      expect(gpuLabel?.className).toMatch(/disabled/)
    })

    it('should not apply disabled style when WebGL is available', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const gpuLabel = screen
        .getByRole('radio', { name: /gpu/i })
        .closest('label')
      expect(gpuLabel?.className).not.toMatch(/disabled/)
    })
  })

  describe('Value changes', () => {
    it('should update checked state when value prop changes', () => {
      const { rerender } = render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByRole('radio', { name: /auto/i })).toBeChecked()

      rerender(
        <ProcessorSelectorView
          value='cpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByRole('radio', { name: /^cpu$/i })).toBeChecked()
      expect(screen.getByRole('radio', { name: /auto/i })).not.toBeChecked()

      rerender(
        <ProcessorSelectorView
          value='gpu'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByRole('radio', { name: /gpu/i })).toBeChecked()
      expect(screen.getByRole('radio', { name: /^cpu$/i })).not.toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('should have proper radio group structure', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      for (const radio of radios) {
        expect(radio).toHaveAttribute('name', 'processor')
        expect(radio).toHaveAttribute('type', 'radio')
      }
    })

    it('should have correct values for each radio', () => {
      render(
        <ProcessorSelectorView
          value='auto'
          onChange={mockOnChange}
          hasWebGL={true}
        />
      )

      expect(screen.getByRole('radio', { name: /auto/i })).toHaveAttribute(
        'value',
        'auto'
      )
      expect(screen.getByRole('radio', { name: /^cpu$/i })).toHaveAttribute(
        'value',
        'cpu'
      )
      expect(screen.getByRole('radio', { name: /gpu/i })).toHaveAttribute(
        'value',
        'gpu'
      )
    })
  })
})
