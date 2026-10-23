import { anchorScroll, fitZoom, zoomIn, zoomOut } from './stage-zoom'

describe('fitZoom', () => {
  it('takes the largest whole factor that fits the image', () => {
    expect(fitZoom({ width: 16, height: 8 }, { width: 100, height: 50 })).toBe(
      6
    )
  })

  it('lets the shorter side of the stage decide', () => {
    expect(fitZoom({ width: 16, height: 8 }, { width: 100, height: 20 })).toBe(
      2
    )
  })

  it('shrinks an image larger than the stage by a fraction', () => {
    expect(
      fitZoom({ width: 400, height: 100 }, { width: 100, height: 100 })
    ).toBe(0.25)
  })

  it('keeps the image at its own size while the stage has no size', () => {
    expect(fitZoom({ width: 16, height: 8 }, { width: 0, height: 0 })).toBe(1)
  })
})

/** An image small enough for every step. */
const SMALL = { width: 16, height: 8 }

describe('zoomIn', () => {
  it('climbs to the next step', () => {
    expect(zoomIn(1, SMALL)).toBe(2)
  })

  it('climbs from a fitted factor to the step above it', () => {
    expect(zoomIn(5, SMALL)).toBe(6)
  })

  it('stays at the last step', () => {
    expect(zoomIn(8, SMALL)).toBe(8)
  })

  it('stops before the canvas grows past what a browser draws', () => {
    expect(zoomIn(4, { width: 2000, height: 100 })).toBe(4)
  })
})

describe('zoomOut', () => {
  it('goes down to the step below', () => {
    expect(zoomOut(3, 1)).toBe(2)
  })

  it('goes down from a fitted factor to the step below it', () => {
    expect(zoomOut(5, 5)).toBe(4)
  })

  it('stays at the image size when the image fits the stage', () => {
    expect(zoomOut(1, 1)).toBe(1)
  })

  it('goes down to the fitted fraction of a large image', () => {
    expect(zoomOut(1, 0.25)).toBe(0.25)
  })
})

/** Along one axis: a 100 px stage, the pointer in its middle. */
const AXIS = { scroll: 0, pointer: 50, viewport: 100 }

describe('anchorScroll', () => {
  it('keeps the pixel under the pointer in place', () => {
    expect(anchorScroll({ ...AXIS, length: 100, from: 1, to: 2 })).toBe(50)
  })

  it('counts what the stage has already scrolled', () => {
    expect(
      anchorScroll({
        ...AXIS,
        scroll: 30,
        pointer: 20,
        length: 100,
        from: 2,
        to: 4
      })
    ).toBe(80)
  })

  it('reads the pointer on an image centred in the stage', () => {
    expect(anchorScroll({ ...AXIS, length: 60, from: 1, to: 2 })).toBe(10)
  })

  it('does not scroll an image smaller than the stage', () => {
    expect(anchorScroll({ ...AXIS, length: 10, from: 2, to: 4 })).toBe(0)
  })

  it('never scrolls past the end of the image', () => {
    expect(
      anchorScroll({ ...AXIS, pointer: 100, length: 60, from: 1, to: 2 })
    ).toBe(20)
  })
})
