import React from 'react'
import { Popover as ThemePopover } from '@radix-ui/themes'

export type PopoverProps = {
  isOpen: boolean
  onClose: () => void
  getPopoverStyle?: () => React.CSSProperties
  children: React.ReactNode
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  popoverRef?: React.RefObject<HTMLDivElement | null>
  trigger: React.ReactElement
}

/**
 * Popover component wrapping @radix-ui/themes Popover.
 *
 * @param {boolean} isOpen - Whether the popover is open.
 * @param {() => void} onClose - Callback when the popover should close.
 * @param {() => React.CSSProperties} [getPopoverStyle] - Optional function to provide custom styles for the popover content.
 * @param {React.ReactNode} children - The content to display inside the popover.
 * @param {(e: React.KeyboardEvent<HTMLDivElement>) => void} [onKeyDown] - Optional keyboard event handler for the popover content.
 * @param {React.RefObject<HTMLDivElement | null>} [popoverRef] - Optional ref for the popover content element.
 * @param {React.ReactElement} trigger - The element that triggers the popover.
 *
 * @returns {JSX.Element} The themed popover component.
 */
export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  getPopoverStyle,
  children,
  onKeyDown,
  popoverRef,
  trigger
}) => {
  const contentProps = {
    ref: popoverRef,
    onKeyDown,
    tabIndex: -1,
    role: 'dialog' as const,
    'aria-modal': 'true' as const,
    ...(getPopoverStyle ? { style: getPopoverStyle() } : {})
  }
  return (
    <ThemePopover.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <ThemePopover.Trigger>{trigger}</ThemePopover.Trigger>
      <ThemePopover.Content {...contentProps}>{children}</ThemePopover.Content>
    </ThemePopover.Root>
  )
}
