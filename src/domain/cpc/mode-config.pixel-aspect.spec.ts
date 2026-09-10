import { cpcPixelAspect } from './mode-config'

describe('cpcPixelAspect', () => {
  it('makes a mode 0 pixel twice as wide as it is tall', () => {
    expect(cpcPixelAspect(0)).toEqual({ x: 2, y: 1 })
  })

  it('makes a mode 1 pixel square', () => {
    expect(cpcPixelAspect(1)).toEqual({ x: 1, y: 1 })
  })

  it('makes a mode 2 pixel twice as tall as it is wide', () => {
    expect(cpcPixelAspect(2)).toEqual({ x: 1, y: 2 })
  })
})
