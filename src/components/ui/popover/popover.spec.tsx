import { render, screen, fireEvent } from '@testing-library/react'
import { Popover, PopoverProps } from './popover'
import React, { useRef } from 'react'

describe('Popover', () => {
  const TestPopover = (props?: Partial<PopoverProps>) => {
    const ref = useRef<HTMLDivElement>(null)
    const anchorRef = useRef<HTMLButtonElement>(null)
    return (
      <>
        <button ref={anchorRef} data-testid='trigger'>
          Trigger
        </button>
        <Popover
          isOpen={props?.isOpen ?? true}
          onClose={props?.onClose ?? (() => {})}
          getPopoverStyle={props?.getPopoverStyle}
          onKeyDown={props?.onKeyDown}
          popoverRef={props?.popoverRef ?? ref}
        >
          <div data-testid='popover-content'>Popover Content</div>
        </Popover>
      </>
    )
  }

  it('renders content when open', () => {
    render(<TestPopover isOpen={true} />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.getByTestId('popover-content')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<TestPopover isOpen={false} />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument()
  })

  it('calls onClose when clicking outside', () => {
    const onClose = vi.fn()
    render(<TestPopover isOpen={true} onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalled()
  })

  it('applies custom style from getPopoverStyle', () => {
    render(<TestPopover getPopoverStyle={() => ({ backgroundColor: 'red' })} />)
    const content = screen.getByTestId('popover-content').parentElement
    expect(content).toHaveStyle({ backgroundColor: 'red' })
  })

  it('forwards popoverRef to the content element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<TestPopover popoverRef={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.getAttribute('role')).toBe('dialog')
  })

  it('calls onKeyDown when key is pressed in content', () => {
    const onKeyDown = vi.fn()
    render(<TestPopover onKeyDown={onKeyDown} />)
    const content = screen.getByTestId('popover-content').parentElement
    if (content) {
      fireEvent.keyDown(content, { key: 'Escape' })
      expect(onKeyDown).toHaveBeenCalled()
    }
  })
})
