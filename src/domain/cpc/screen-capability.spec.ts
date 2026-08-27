import type { CpcModeConfig } from './mode-config'
import {
  CPC_SCREEN_MEMORY_BYTES,
  type EgxScreen,
  isStandardEgxScreen,
  isStandardScreen,
  maxScreenAddress,
  screenCapability
} from './screen-capability'

function geometry(over: Partial<CpcModeConfig> = {}): CpcModeConfig {
  return {
    mode: 0,
    width: 160,
    height: 200,
    overscan: false,
    nColors: 16,
    scaleX: 4,
    scaleY: 2,
    ...over
  }
}

describe('isStandardScreen', () => {
  const cases: Array<[string, Partial<CpcModeConfig>, boolean]> = [
    ['mode 0 at 160×200', { mode: 0, width: 160, height: 200 }, true],
    ['mode 1 at 320×200', { mode: 1, width: 320, height: 200 }, true],
    ['mode 2 at 640×200', { mode: 2, width: 640, height: 200 }, true],
    ["mode 0 at mode 1's width", { mode: 0, width: 320, height: 200 }, false],
    ['a custom width', { mode: 1, width: 400, height: 200 }, false],
    ['a custom height', { mode: 1, width: 320, height: 300 }, false],
    ['mode 2 at 800×400', { mode: 2, width: 800, height: 400 }, false],
    [
      'overscan at standard dimensions',
      { mode: 1, width: 320, height: 200, overscan: true },
      false
    ]
  ]

  it.each(cases)('%s → %s', (_label, over, expected) => {
    expect(isStandardScreen(geometry(over))).toBe(expected)
  })

  it('answers false for a mode that is not a CPC mode', () => {
    // The DSK utils still carry an untyped mode from their public API.
    expect(
      isStandardScreen({
        mode: 3 as CpcModeConfig['mode'],
        width: 160,
        height: 200,
        overscan: false
      })
    ).toBe(false)
  })
})

describe('isStandardEgxScreen', () => {
  const cases: Array<[EgxScreen, boolean]> = [
    [{ type: 'egx1', width: 320, height: 200 }, true],
    [{ type: 'egx2', width: 640, height: 200 }, true],
    [{ type: 'egx1', width: 640, height: 200 }, false],
    [{ type: 'egx2', width: 320, height: 200 }, false],
    [{ type: 'egx1', width: 320, height: 272 }, false]
  ]

  it.each(cases)('%o → %s', (egx, expected) => {
    expect(isStandardEgxScreen(egx)).toBe(expected)
  })
})

describe('maxScreenAddress', () => {
  it('stays under the 16 KB screen memory for every standard mode', () => {
    for (const over of [
      { mode: 0, width: 160 },
      { mode: 1, width: 320 },
      { mode: 2, width: 640 }
    ] as const) {
      expect(maxScreenAddress(geometry({ ...over, height: 200 }))).toBe(16335)
    }
    expect(16335).toBeLessThan(CPC_SCREEN_MEMORY_BYTES)
  })

  it('grows past the screen memory for a taller screen', () => {
    expect(
      maxScreenAddress(geometry({ mode: 1, width: 320, height: 272 }))
    ).toBeGreaterThanOrEqual(CPC_SCREEN_MEMORY_BYTES)
  })
})

describe('screenCapability', () => {
  it('allows both formats on a standard screen', () => {
    expect(screenCapability(geometry())).toEqual({
      isStandard: true,
      canExportScr: true,
      canExportSna: true
    })
  })

  it('allows SCR but not SNA on a custom screen that fits screen memory', () => {
    // 288×200 in mode 1 → 72 bytes per line, still under 16 KB.
    expect(screenCapability(geometry({ mode: 1, width: 288 }))).toEqual({
      isStandard: false,
      canExportScr: true,
      canExportSna: false
    })
  })

  it('refuses SCR when the screen does not fit memory', () => {
    const capability = screenCapability(
      geometry({ mode: 1, width: 320, height: 272 })
    )
    expect(capability.canExportScr).toBe(false)
    expect(capability.isStandard).toBe(false)
  })

  it('allows SNA but not SCR on overscan', () => {
    expect(
      screenCapability(
        geometry({ mode: 1, width: 384, height: 272, overscan: true })
      )
    ).toEqual({
      isStandard: false,
      canExportScr: false,
      canExportSna: true
    })
  })

  it('reads the standard verdict from the EGX screen when one is given', () => {
    // The underlying mode config is a plain mode 1 screen; the EGX screen is not
    // a native EGX resolution, so the image is not standard even though the
    // mode config alone would say it is.
    const capability = screenCapability(geometry({ mode: 1, width: 320 }), {
      type: 'egx1',
      width: 320,
      height: 272
    })
    expect(capability.isStandard).toBe(false)
    // The SCR fit still follows the mode config — that is what is written out.
    expect(capability.canExportScr).toBe(true)
  })

  it('accepts a native EGX2 screen', () => {
    expect(
      screenCapability(geometry({ mode: 2, width: 640 }), {
        type: 'egx2',
        width: 640,
        height: 200
      }).isStandard
    ).toBe(true)
  })
})
