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

  // The table is a declaration, so it is pinned whole: a single flipped flag is
  // a capability quietly gained or lost, and cherry-picking rows lets that
  // through. Each `false` below is a real gap documented in the module.

  it('grants the standard path everything', () => {
    expect(renderingPathCapabilities('standard')).toEqual({
      manualEdits: true,
      editor: true,
      indexBuffer: true,
      displayPalette: true,
      distinctMappingForcesNoDither: true
    })
  })

  it('denies the raster path a 16-slot palette and the distinct-mapping rule', () => {
    expect(renderingPathCapabilities('raster')).toEqual({
      manualEdits: true,
      editor: true,
      indexBuffer: true,
      displayPalette: false,
      distinctMappingForcesNoDither: false
    })
  })

  it('denies the EGX path only the distinct-mapping rule', () => {
    expect(renderingPathCapabilities('egx')).toEqual({
      manualEdits: true,
      editor: true,
      indexBuffer: true,
      displayPalette: true,
      distinctMappingForcesNoDither: false
    })
  })

  it('denies Mode R everything that assumes a single buffer', () => {
    expect(renderingPathCapabilities('mode-r')).toEqual({
      manualEdits: false,
      editor: false,
      indexBuffer: false,
      displayPalette: false,
      distinctMappingForcesNoDither: false
    })
  })
})
