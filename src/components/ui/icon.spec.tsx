import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Icon, { type IconName } from './icon'

// Mock the logger to avoid console output in tests
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn()
  }
}))

describe('Icon', () => {
  it('renders a valid icon', () => {
    const { container } = render(<Icon name='PlusIcon' />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <Icon name='PlusIcon' className='custom-class' />
    )

    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('custom-class')
  })

  it('applies custom size', () => {
    const { container } = render(<Icon name='PlusIcon' size={24} />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
  })

  it('has aria-hidden true by default', () => {
    const { container } = render(<Icon name='PlusIcon' />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('can override aria-hidden', () => {
    const { container } = render(<Icon name='PlusIcon' aria-hidden={false} />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'false')
  })

  it('returns null for invalid icon name', () => {
    const { container } = render(<Icon name={'InvalidIcon' as any} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders all available icons', () => {
    const iconNames: IconName[] = [
      'PlusIcon',
      'Cross2Icon',
      'DownloadIcon',
      'GearIcon',
      'GitHubLogoIcon',
      'ImageIcon',
      'InfoCircledIcon',
      'LockClosedIcon',
      'ReloadIcon',
      'UploadIcon',
      'CheckIcon',
      'ChevronDownIcon',
      'ChevronLeftIcon',
      'ChevronRightIcon',
      'ChevronUpIcon'
    ]

    for (const iconName of iconNames) {
      const { container, unmount } = render(<Icon name={iconName} />)
      expect(container.firstChild).not.toBeNull()
      unmount()
    }
  })
})
