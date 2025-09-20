import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ColorPickerPopup, type ColorPickerPopupProps } from './color-picker-popup'
import type { Vector } from '@/libs/pixsaur-color/src/type'

// Mock CSS modules
vi.mock('./color-picker-popup.module.css', () => ({
  default: {
    popup: 'popup',
    header: 'header', 
    title: 'title',
    closeButton: 'closeButton',
    content: 'content',
    colorPreview: 'colorPreview',
    colorValue: 'colorValue',
    slidersContainer: 'slidersContainer',
    actions: 'actions',
    lockButton: 'lockButton'
  }
}))

describe('ColorPickerPopup', () => {
  const defaultProps: ColorPickerPopupProps = {
    initialColor: [255, 0, 0] as Vector, // Rouge
    isLocked: false,
    onColorConfirm: vi.fn(),
    onToggleLock: vi.fn(),
    onClose: vi.fn()
  }

  it('should render with initial color', () => {
    render(<ColorPickerPopup {...defaultProps} />)
    
    expect(screen.getByText('RGB(255, 0, 0)')).toBeInTheDocument()
  })

  it('should display correct lock state', () => {
    const lockedProps = { ...defaultProps, isLocked: true }
    render(<ColorPickerPopup {...lockedProps} />)
    
    expect(screen.getByText('Déverrouiller')).toBeInTheDocument()
  })

  it('should display unlock state when not locked', () => {
    render(<ColorPickerPopup {...defaultProps} />)
    
    expect(screen.getByText('Verrouiller')).toBeInTheDocument()
  })

  it('should call onToggleLock when lock button is clicked', async () => {
    const onToggleLock = vi.fn()
    render(<ColorPickerPopup {...defaultProps} onToggleLock={onToggleLock} />)
    
    await userEvent.click(screen.getByText('Verrouiller'))
    expect(onToggleLock).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn()
    render(<ColorPickerPopup {...defaultProps} onClose={onClose} />)
    
    await userEvent.click(screen.getByText('Annuler'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn()
    render(<ColorPickerPopup {...defaultProps} onClose={onClose} />)
    
    await userEvent.click(screen.getByText('Annuler'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onColorConfirm and onClose when validate button is clicked', async () => {
    const onColorConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ColorPickerPopup {...defaultProps} onColorConfirm={onColorConfirm} onClose={onClose} />)
    
    await userEvent.click(screen.getByText('Valider'))
    
    expect(onColorConfirm).toHaveBeenCalledTimes(1)
    expect(onColorConfirm).toHaveBeenCalledWith([255, 0, 0]) // Couleur initiale
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should hide lock button when hideLockButton is true', () => {
    render(<ColorPickerPopup {...defaultProps} hideLockButton={true} />)
    
    expect(screen.queryByText('Verrouiller')).not.toBeInTheDocument()
    expect(screen.queryByText('Déverrouiller')).not.toBeInTheDocument()
  })

  it('should display color preview with correct background', () => {
    render(<ColorPickerPopup {...defaultProps} />)
    
    const preview = screen.getByTitle('RGB(255, 0, 0)')
    expect(preview).toHaveStyle('background-color: rgb(255, 0, 0)')
  })
})