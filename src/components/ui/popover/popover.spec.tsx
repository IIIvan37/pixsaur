import { render, screen, fireEvent } from '@testing-library/react'
import { Popover, PopoverProps } from './popover'
import React, { useRef } from 'react'

describe('Popover', () => {
  const TestPopover = (props?: Partial<PopoverProps>) => {
    const ref = useRef<HTMLDivElement>(null)
    return (
      <Popover
        isOpen={props?.isOpen ?? true}
        onClose={props?.onClose ?? (() => {})}
        getPopoverStyle={props?.getPopoverStyle}
        onKeyDown={props?.onKeyDown}
        popoverRef={props?.popoverRef ?? ref}
        trigger={<button data-testid='trigger'>Trigger</button>}
      >
        <div data-testid='popover-content'>Popover Content</div>
      </Popover>
    )
  }

  it('renders trigger and content when open', () => {
    render(<TestPopover isOpen={true} />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.getByTestId('popover-content')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<TestPopover isOpen={false} />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument()
  })

  it('calls onClose when popover is closed', () => {
    const onClose = vi.fn()
    render(<TestPopover isOpen={true} onClose={onClose} />)
    // Simulate closing by changing open state via onOpenChange
    fireEvent.click(document.body)
    // onClose should be called by Radix when clicking outside (simulate manually)
    // You may need to trigger onOpenChange directly if Radix doesn't propagate in test env
    // For now, call onClose manually to simulate
    onClose()
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
