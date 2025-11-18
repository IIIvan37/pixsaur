import { screen } from '@testing-library/react'
import React from 'react'
import { renderWithI18n } from '@/test-utils'
import { ImagePreviewView } from './image-preview-view'

describe('ImagePreviewView', () => {
  it('renders empty message when no image is provided', () => {
    renderWithI18n(
      <ImagePreviewView
        ref={React.createRef()}
        image={null}
        containerRefCallback={(_: HTMLDivElement | null): void => {
          throw new Error('Function not implemented.')
        }}
        width={0}
        height={0}
      />
    )
    expect(screen.getByText(/Aucune image traitée/i)).toBeInTheDocument()
  })

  it('renders a canvas when image is provided', () => {
    // Create a dummy ImageData object
    const imageData = new ImageData(320, 200)
    const ref = React.createRef<HTMLCanvasElement>()
    renderWithI18n(
      <ImagePreviewView
        ref={ref}
        image={imageData}
        containerRefCallback={() => {}}
        width={320}
        height={200}
      />
    )

    // fallback: check for canvas element
    expect(document.querySelector('canvas')).toBeInTheDocument()
  })
})
