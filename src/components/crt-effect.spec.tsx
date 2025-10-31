import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CrtEffect from './crt-effect'

describe('CrtEffect', () => {
  it('renders container with correct structure', () => {
    const { container } = render(<CrtEffect />)

    // Check that the main container exists
    const crtContainer = container.firstChild as HTMLElement
    expect(crtContainer).toBeInTheDocument()
    expect(crtContainer.tagName).toBe('DIV')

    // Check that scanlines element exists
    const scanlines = crtContainer.firstChild as HTMLElement
    expect(scanlines).toBeInTheDocument()
    expect(scanlines.tagName).toBe('DIV')
  })

  it('renders scanlines element', () => {
    const { container } = render(<CrtEffect />)

    // Find scanlines element using querySelector
    const scanlines = container.querySelector('div div')
    expect(scanlines).toBeInTheDocument()
  })

  it('has correct DOM structure', () => {
    const { container } = render(<CrtEffect />)

    // Check the DOM structure: div > div
    const outerDiv = container.firstChild
    expect(outerDiv).toBeInTheDocument()

    const innerDiv = outerDiv?.firstChild
    expect(innerDiv).toBeInTheDocument()
  })
})
