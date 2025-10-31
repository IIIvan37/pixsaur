import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/app/store/locale'
import { LanguageSelector } from './language-selector'

// Mock Jotai
const mockSetLocale = vi.fn()
vi.mock('jotai', () => ({
  useAtom: vi.fn(() => ['fr', mockSetLocale])
}))

// Mock the Select components
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      data-testid='language-select'
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectItem: ({ children, value }: any) => (
    <option value={value}>{children}</option>
  )
}))

describe('LanguageSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders language selector with current locale', () => {
    render(<LanguageSelector />)

    const select = screen.getByTestId('language-select')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('fr')
  })

  it('renders all supported locales as options', () => {
    render(<LanguageSelector />)

    for (const locale of SUPPORTED_LOCALES) {
      const option = screen.getByText(LOCALE_NAMES[locale])
      expect(option).toBeInTheDocument()
    }
  })

  it('calls setLocale when language is changed', () => {
    render(<LanguageSelector />)

    const select = screen.getByTestId('language-select')
    fireEvent.change(select, { target: { value: 'en' } })

    expect(mockSetLocale).toHaveBeenCalledWith('en')
  })

  it('has correct structure', () => {
    const { container } = render(<LanguageSelector />)

    expect(container.firstChild).toBeInTheDocument()
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
  })
})
