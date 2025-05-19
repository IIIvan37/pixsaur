import React, { useEffect, useRef } from 'react'

/**
 * Popover component that displays its children in a floating dialog.
 *
 * @param {boolean} isOpen - Whether the popover is open and visible.
 * @param {() => void} onClose - Callback invoked when the popover should close (e.g., clicking outside).
 * @param {() => React.CSSProperties} [getPopoverStyle] - Optional function to provide custom styles for the popover content.
 * @param {React.ReactNode} children - The content to display inside the popover.
 * @param {(e: React.KeyboardEvent<HTMLDivElement>) => void} [onKeyDown] - Optional keyboard event handler for the popover content.
 * @param {React.RefObject<HTMLDivElement | null>} [popoverRef] - Optional ref for the popover content element.
 *
 * @returns {JSX.Element | null} The popover content if open, otherwise null.
 */
export type PopoverProps = {
  isOpen: boolean
  onClose: () => void
  getPopoverStyle?: () => React.CSSProperties
  children: React.ReactNode
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  popoverRef?: React.RefObject<HTMLDivElement | null>
}

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  getPopoverStyle,
  children,
  onKeyDown,
  popoverRef
}) => {
  const localRef = useRef<HTMLDivElement>(null)
  const ref = popoverRef || localRef

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose, ref])

  // Focus management (optional)
  useEffect(() => {
    if (isOpen && ref.current) {
      ref.current.focus()
    }
  }, [isOpen, ref])

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      style={getPopoverStyle ? getPopoverStyle() : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role='dialog'
      aria-modal='true'
    >
      {children}
    </div>
  )
}
