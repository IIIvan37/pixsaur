import { render, screen } from '@testing-library/react'
import React from 'react'
import { ImagePreviewView } from './image-preview-view'

describe('ImagePreviewView', () => {
  it('renders empty message when no image is provided', () => {
    render(<ImagePreviewView ref={React.createRef()} image={null} />)
    expect(screen.getByText(/Aucune image traitée/i)).toBeInTheDocument()
  })

  it('renders a canvas when image is provided', () => {
    // Create a dummy ImageData object
    const imageData = new ImageData(320, 200)
    const ref = React.createRef<HTMLCanvasElement>()
    render(<ImagePreviewView ref={ref} image={imageData} />)

    // fallback: check for canvas element
    expect(document.querySelector('canvas')).toBeInTheDocument()
    expect(document.querySelector('canvas')).toHaveAttribute('width', '320')
    expect(document.querySelector('canvas')).toHaveAttribute('height', '200')
  })
})
