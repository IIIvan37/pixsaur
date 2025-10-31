import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionTitle } from './section-title'
import styles from './section-title.module.css'

describe('SectionTitle', () => {
  it('renders with default props', () => {
    render(<SectionTitle>Test Title</SectionTitle>)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('Test Title')
    expect(title).toHaveClass(styles.sectionTitle)
  })

  it('renders h2 by default', () => {
    render(<SectionTitle>Default Level</SectionTitle>)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('H2')
  })

  it('renders h3 when level is 3', () => {
    render(<SectionTitle level={3}>Level 3 Title</SectionTitle>)

    const title = screen.getByRole('heading', { level: 3 })
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('H3')
  })

  it('renders h4 when level is 4', () => {
    render(<SectionTitle level={4}>Level 4 Title</SectionTitle>)

    const title = screen.getByRole('heading', { level: 4 })
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('H4')
  })

  it('applies custom className', () => {
    render(<SectionTitle className='custom-class'>Custom Title</SectionTitle>)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveClass(styles.sectionTitle, 'custom-class')
  })

  it('handles empty className', () => {
    render(<SectionTitle className=''>Empty Class</SectionTitle>)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveClass(styles.sectionTitle)
    expect(title.className.trim()).toBe(styles.sectionTitle)
  })

  it('renders complex children', () => {
    render(
      <SectionTitle>
        <span>Icon</span> Complex Title
      </SectionTitle>
    )

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Icon Complex Title')
    expect(screen.getByText('Icon')).toBeInTheDocument()
  })

  it('has proper semantic structure', () => {
    render(<SectionTitle>Semantic Title</SectionTitle>)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Semantic Title')
    expect(title).not.toHaveAttribute('aria-level')
  })

  it('maintains accessibility with different levels', () => {
    const { rerender } = render(<SectionTitle level={2}>H2 Title</SectionTitle>)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()

    rerender(<SectionTitle level={3}>H3 Title</SectionTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()

    rerender(<SectionTitle level={4}>H4 Title</SectionTitle>)
    expect(screen.getByRole('heading', { level: 4 })).toBeInTheDocument()
  })
})
