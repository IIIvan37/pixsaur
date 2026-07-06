import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Vector } from '@/libs/pixsaur-color/src/type'
import { renderWithI18n } from '@/test-utils'
import {
  ColorPickerPopup,
  type ColorPickerPopupProps
} from './color-picker-popup'

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
    onClearSlot: vi.fn(),
    onClose: vi.fn()
  }

  it('should render with initial color', () => {
    renderWithI18n(<ColorPickerPopup {...defaultProps} />)

    expect(screen.getByText('RGB(255, 0, 0)')).toBeInTheDocument()
  })

  it('should display correct lock state', () => {
    const lockedProps = { ...defaultProps, isLocked: true }
    renderWithI18n(<ColorPickerPopup {...lockedProps} />)

    expect(screen.getByText('Déverrouiller')).toBeInTheDocument()
  })

  it('should not display unlock button when not locked', () => {
    renderWithI18n(<ColorPickerPopup {...defaultProps} />)

    // Aucun bouton de verrouillage ne devrait être affiché quand pas verrouillé
    expect(screen.queryByText('Déverrouiller')).not.toBeInTheDocument()
  })

  it('should call onToggleLock when unlock button is clicked on locked color', async () => {
    const onToggleLock = vi.fn()
    const lockedProps = { ...defaultProps, isLocked: true, onToggleLock }
    renderWithI18n(<ColorPickerPopup {...lockedProps} />)

    await userEvent.click(screen.getByText('Déverrouiller'))
    expect(onToggleLock).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn()
    renderWithI18n(<ColorPickerPopup {...defaultProps} onClose={onClose} />)

    await userEvent.click(screen.getByText('Annuler'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onColorConfirm and onClose when validate button is clicked', async () => {
    const onColorConfirm = vi.fn()
    const onClose = vi.fn()
    renderWithI18n(
      <ColorPickerPopup
        {...defaultProps}
        onColorConfirm={onColorConfirm}
        onClose={onClose}
      />
    )

    await userEvent.click(screen.getByText('Valider'))

    expect(onColorConfirm).toHaveBeenCalledTimes(1)
    expect(onColorConfirm).toHaveBeenCalledWith([255, 0, 0]) // Couleur initiale
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should not display any lock button when color is not locked', () => {
    renderWithI18n(<ColorPickerPopup {...defaultProps} />)

    expect(screen.queryByText('Verrouiller')).not.toBeInTheDocument()
    expect(screen.queryByText('Déverrouiller')).not.toBeInTheDocument()
  })

  it('should display color preview with correct background', () => {
    renderWithI18n(<ColorPickerPopup {...defaultProps} />)

    const preview = screen.getByTitle('RGB(255, 0, 0)')
    expect(preview).toHaveStyle('background-color: rgb(255, 0, 0)')
  })

  it('should display clear button', () => {
    renderWithI18n(<ColorPickerPopup {...defaultProps} />)

    expect(screen.getByText('Vider')).toBeInTheDocument()
  })

  it('should call onClearSlot when clear button is clicked', async () => {
    const onClearSlot = vi.fn()
    renderWithI18n(
      <ColorPickerPopup {...defaultProps} onClearSlot={onClearSlot} />
    )

    await userEvent.click(screen.getByText('Vider'))
    expect(onClearSlot).toHaveBeenCalledTimes(1)
  })
})
