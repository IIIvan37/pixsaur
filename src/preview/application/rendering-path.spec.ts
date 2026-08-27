import {
  RENDERING_PATHS,
  type RenderingPathFlags,
  renderingPathCapabilities,
  resolveRenderingPath
} from './rendering-path'

const NOTHING_ENABLED: RenderingPathFlags = {
  modeREnabled: false,
  egxEnabled: false,
  rasterEnabled: false,
  rasterChangeCount: 0
}

describe('resolveRenderingPath', () => {
  it('is the standard path when no alternate mode is enabled', () => {
    expect(resolveRenderingPath(NOTHING_ENABLED)).toBe('standard')
  })

  it('is Mode R when Mode R is enabled', () => {
    expect(
      resolveRenderingPath({ ...NOTHING_ENABLED, modeREnabled: true })
    ).toBe('mode-r')
  })

  it('is EGX when EGX is enabled', () => {
    expect(resolveRenderingPath({ ...NOTHING_ENABLED, egxEnabled: true })).toBe(
      'egx'
    )
  })

  it('is raster when raster is enabled and carries at least one change', () => {
    expect(
      resolveRenderingPath({
        ...NOTHING_ENABLED,
        rasterEnabled: true,
        rasterChangeCount: 1
      })
    ).toBe('raster')
  })

  it('falls back to standard when raster is enabled with no change', () => {
    expect(
      resolveRenderingPath({ ...NOTHING_ENABLED, rasterEnabled: true })
    ).toBe('standard')
  })

  it('prefers Mode R over EGX when the config leaks both', () => {
    expect(
      resolveRenderingPath({
        ...NOTHING_ENABLED,
        modeREnabled: true,
        egxEnabled: true
      })
    ).toBe('mode-r')
  })

  it('prefers EGX over raster when the config leaks both', () => {
    expect(
      resolveRenderingPath({
        ...NOTHING_ENABLED,
        egxEnabled: true,
        rasterEnabled: true,
        rasterChangeCount: 3
      })
    ).toBe('egx')
  })
})

describe('renderingPathCapabilities', () => {
  it('declares a capability set for every path', () => {
    expect(
      RENDERING_PATHS.every((path) => renderingPathCapabilities(path))
    ).toBe(true)
  })

  it('grants manual edits to the standard path', () => {
    expect(renderingPathCapabilities('standard').manualEdits).toBe(true)
  })

  it('grants manual edits to the raster path', () => {
    expect(renderingPathCapabilities('raster').manualEdits).toBe(true)
  })

  it('grants manual edits to the EGX path', () => {
    expect(renderingPathCapabilities('egx').manualEdits).toBe(true)
  })

  it('denies manual edits to Mode R', () => {
    expect(renderingPathCapabilities('mode-r').manualEdits).toBe(false)
  })

  it('denies the pixel editor to Mode R', () => {
    expect(renderingPathCapabilities('mode-r').editor).toBe(false)
  })

  it('denies a single index buffer to Mode R', () => {
    expect(renderingPathCapabilities('mode-r').indexBuffer).toBe(false)
  })

  it('denies a 16-slot display palette to Mode R', () => {
    expect(renderingPathCapabilities('mode-r').displayPalette).toBe(false)
  })

  it('denies a 16-slot display palette to the raster path', () => {
    expect(renderingPathCapabilities('raster').displayPalette).toBe(false)
  })

  it('forces dithering off under distinct mapping on the standard path', () => {
    expect(
      renderingPathCapabilities('standard').distinctMappingForcesNoDither
    ).toBe(true)
  })

  it('leaves dithering untouched under distinct mapping on the EGX path', () => {
    expect(renderingPathCapabilities('egx').distinctMappingForcesNoDither).toBe(
      false
    )
  })

  it('leaves dithering untouched under distinct mapping on Mode R', () => {
    expect(
      renderingPathCapabilities('mode-r').distinctMappingForcesNoDither
    ).toBe(false)
  })
})
