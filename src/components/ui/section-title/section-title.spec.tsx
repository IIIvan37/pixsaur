import { render, screen } from '@testing-library/react'
import { SectionTitle } from './section-title'

describe('SectionTitle', () => {
  test('renders with default h2 level', () => {
    render(<SectionTitle>Test Title</SectionTitle>)
    
    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('Test Title')
    expect(title.tagName).toBe('H2')
  })

  test('renders with custom heading level', () => {
    render(<SectionTitle level={3}>Custom Level</SectionTitle>)
    
    const title = screen.getByRole('heading', { level: 3 })
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('H3')
  })

  test('applies custom className', () => {
    render(<SectionTitle className="custom-class">Styled Title</SectionTitle>)
    
    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveClass('custom-class')
  })

  test('applies section title styles', () => {
    render(<SectionTitle>Styled Title</SectionTitle>)
    
    const title = screen.getByRole('heading', { level: 2 })
    expect(title.className).toContain('sectionTitle')
  })

  test('handles React nodes as children', () => {
    render(
      <SectionTitle>
        <span>Complex</span> Title
      </SectionTitle>
    )
    
    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toHaveTextContent('Complex Title')
  })
})