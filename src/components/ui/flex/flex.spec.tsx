import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Flex from './flex'

describe('Flex', () => {
  it('renders with children', () => {
    render(
      <Flex>
        <div>Child 1</div>
        <div>Child 2</div>
      </Flex>
    )

    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
  })

  it('applies default flex styles', () => {
    const { container } = render(
      <Flex>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap'
    })
  })

  it('applies custom direction', () => {
    const { container } = render(
      <Flex direction='column'>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({ flexDirection: 'column' })
  })

  it('applies custom gap', () => {
    const { container } = render(
      <Flex gap='1rem'>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({ gap: '1rem' })
  })

  it('applies custom align', () => {
    const { container } = render(
      <Flex align='flex-start'>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({ alignItems: 'flex-start' })
  })

  it('applies custom justify', () => {
    const { container } = render(
      <Flex justify='space-between'>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({ justifyContent: 'space-between' })
  })

  it('applies custom wrap', () => {
    const { container } = render(
      <Flex wrap='wrap'>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({ flexWrap: 'wrap' })
  })

  it('merges custom style', () => {
    const { container } = render(
      <Flex style={{ padding: '10px', backgroundColor: 'red' }}>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild as HTMLElement
    expect(flexElement).toHaveStyle({
      display: 'flex',
      padding: '10px',
      backgroundColor: 'red'
    })
  })

  it('renders multiple children with proper spacing', () => {
    render(
      <Flex gap='0.5rem'>
        <span>Item 1</span>
        <span>Item 2</span>
        <span>Item 3</span>
      </Flex>
    )

    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
    expect(screen.getByText('Item 3')).toBeInTheDocument()
  })

  it('renders complex children', () => {
    render(
      <Flex>
        <button type='button'>Button</button>
        <input type='text' placeholder='Input' />
        <div>
          Nested <strong>content</strong>
        </div>
      </Flex>
    )

    expect(screen.getByRole('button')).toHaveTextContent('Button')
    expect(screen.getByPlaceholderText('Input')).toBeInTheDocument()
    expect(screen.getByText('Nested')).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders as div element', () => {
    const { container } = render(
      <Flex>
        <div>Test</div>
      </Flex>
    )

    const flexElement = container.firstChild
    expect(flexElement).toBeInstanceOf(HTMLDivElement)
  })
})
