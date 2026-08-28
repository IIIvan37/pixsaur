import { MAX_HISTORY_SIZE } from '@/editor/application/types'
import type { ConvertedTileset } from './convert-tileset'
import {
  applyTilesetEdits,
  EMPTY_EDIT_LAYER,
  paintTileset,
  redoTilesetEdits,
  type TilesetEditLayer,
  undoTilesetEdits
} from './paint-tileset'

const SHAPE = { tileWidth: 2, tileHeight: 2 }

const clock = { now: () => 1000 }

/** A tileset of 2 x 2 tiles, given as flat runs of pen indices. */
function tilesetOf(tiles: number[][], instanceOf: number[]): ConvertedTileset {
  return {
    columns: tiles.length,
    rows: 1,
    palette: [
      [0, 0, 0],
      [255, 0, 0],
      [0, 255, 0]
    ],
    tiles: tiles.map((indices) => ({ indices: Uint8Array.from(indices) })),
    instanceOf,
    unique: [...new Set(instanceOf)],
    transparentPen: 0,
    collisions: [],
    resizeSearch: null
  }
}

/** A layer of `count` strokes, with the undo cursor standing at `at`. */
function layerOf(count: number, at: number): TilesetEditLayer {
  return {
    strokes: Array.from({ length: count }, (_, index) => ({
      tiles: [0],
      edits: [{ x: 0, y: 0, previousInkIndex: 0, newInkIndex: 1 }],
      timestamp: index
    })),
    at
  }
}

describe('paintTileset', () => {
  it('propage la peinture à toutes les instances de la tuile', () => {
    const tileset = tilesetOf(
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0]
      ],
      [0, 1, 0]
    )

    const layer = paintTileset(
      {
        tileset,
        shape: SHAPE,
        layer: EMPTY_EDIT_LAYER,
        tile: 0,
        pixels: [{ x: 1, y: 0 }],
        pen: 2
      },
      { clock }
    )

    expect(layer.strokes[0].tiles).toEqual([0, 2])
  })

  it('ne retient rien quand le pen est déjà celui du pixel', () => {
    const tileset = tilesetOf([[1, 1, 1, 1]], [0])

    const layer = paintTileset(
      {
        tileset,
        shape: SHAPE,
        layer: EMPTY_EDIT_LAYER,
        tile: 0,
        pixels: [{ x: 1, y: 0 }],
        pen: 1
      },
      { clock }
    )

    expect(layer).toBe(EMPTY_EDIT_LAYER)
  })

  it('refuse un pen que la palette gelée ne porte pas', () => {
    const tileset = tilesetOf([[0, 0, 0, 0]], [0])

    const layer = paintTileset(
      {
        tileset,
        shape: SHAPE,
        layer: EMPTY_EDIT_LAYER,
        tile: 0,
        pixels: [{ x: 0, y: 0 }],
        pen: 7
      },
      { clock }
    )

    expect(layer).toBe(EMPTY_EDIT_LAYER)
  })

  it('abandonne les édits rétablissables quand on repeint', () => {
    const tileset = tilesetOf([[0, 0, 0, 0]], [0])

    const layer = paintTileset(
      {
        tileset,
        shape: SHAPE,
        layer: layerOf(2, 0),
        tile: 0,
        pixels: [{ x: 0, y: 0 }],
        pen: 1
      },
      { clock }
    )

    expect(layer.strokes).toHaveLength(2)
  })

  it("plafonne la pile d'annulation", () => {
    const tileset = tilesetOf([[0, 0, 0, 0]], [0])

    const layer = paintTileset(
      {
        tileset,
        shape: SHAPE,
        layer: layerOf(MAX_HISTORY_SIZE, MAX_HISTORY_SIZE - 1),
        tile: 0,
        pixels: [{ x: 0, y: 0 }],
        pen: 1
      },
      { clock }
    )

    expect(layer.strokes).toHaveLength(MAX_HISTORY_SIZE)
  })
})

describe('undoTilesetEdits', () => {
  it("recule le curseur d'un cran", () => {
    expect(undoTilesetEdits(layerOf(2, 1)).at).toBe(0)
  })

  it('ne recule pas en deçà du premier édit', () => {
    const layer = layerOf(2, -1)

    expect(undoTilesetEdits(layer)).toBe(layer)
  })
})

describe('redoTilesetEdits', () => {
  it("avance le curseur d'un cran", () => {
    expect(redoTilesetEdits(layerOf(2, 0)).at).toBe(1)
  })

  it('ne rétablit rien au sommet de la pile', () => {
    const layer = layerOf(2, 1)

    expect(redoTilesetEdits(layer)).toBe(layer)
  })
})

describe('applyTilesetEdits', () => {
  const tileset = tilesetOf(
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0]
    ],
    [0, 1, 0]
  )

  const painted = paintTileset(
    {
      tileset,
      shape: SHAPE,
      layer: EMPTY_EDIT_LAYER,
      tile: 0,
      pixels: [{ x: 1, y: 0 }],
      pen: 2
    },
    { clock }
  )

  it('rejoue le trait sur toutes les instances de la tuile', () => {
    const edited = applyTilesetEdits(tileset, painted, SHAPE)

    expect([...edited.tiles[2].indices]).toEqual([0, 2, 0, 0])
  })

  it('laisse les tuiles hors du groupe intactes', () => {
    const edited = applyTilesetEdits(tileset, painted, SHAPE)

    expect([...edited.tiles[1].indices]).toEqual([1, 1, 1, 1])
  })

  it('ne rejoue rien au-delà du curseur', () => {
    const edited = applyTilesetEdits(tileset, undoTilesetEdits(painted), SHAPE)

    expect([...edited.tiles[0].indices]).toEqual([0, 0, 0, 0])
  })

  it('rend la planche elle-même quand aucun édit ne tient', () => {
    expect(applyTilesetEdits(tileset, EMPTY_EDIT_LAYER, SHAPE)).toBe(tileset)
  })
})
