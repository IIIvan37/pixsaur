import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/icon'
import styles from './draggable-dialog.module.css'

interface DraggableDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string | React.ReactNode
  readonly children: React.ReactNode
  readonly defaultPosition?: { readonly x: number; readonly y: number }
  readonly onOpenAutoFocus?: (event: Event) => void
}

export default function DraggableDialog({
  open,
  onOpenChange,
  title,
  children,
  defaultPosition = { x: 100, y: 100 },
  onOpenAutoFocus
}: DraggableDialogProps) {
  const [position, setPosition] = useState(defaultPosition)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y

      setPosition((prev) => {
        const content = contentRef.current
        if (!content) return prev

        const newX = prev.x + dx
        const newY = prev.y + dy

        // Get the header height to ensure it stays in view
        const header = content.querySelector(`.${styles.header}`) as HTMLElement
        const headerHeight = header ? header.offsetHeight : 50

        // Constrain position to keep header visible
        const minX = -content.offsetWidth + 100 // Allow some of the content to go off-screen
        const maxX = window.innerWidth - 100 // Keep at least 100px visible
        const minY = 0 // Keep header at least at top of screen
        const maxY = window.innerHeight - headerHeight // Keep header visible

        return {
          x: Math.max(minX, Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY))
        }
      })

      dragStart.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on the drag handle
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(`.${styles.dragHandle}`)
    ) {
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          ref={contentRef}
          className={styles.content}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
          onEscapeKeyDown={() => onOpenChange(false)}
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className={styles.header}>
            <button
              type='button'
              className={styles.dragHandle}
              onMouseDown={handleMouseDown}
              aria-label='Drag to move'
            >
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            </button>
            <Dialog.Close className={styles.closeButton} aria-label='Close'>
              <Icon name='Cross2Icon' />
            </Dialog.Close>
          </div>

          <Dialog.Description className={styles.visuallyHidden}>
            Draggable dialog for development settings
          </Dialog.Description>

          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
