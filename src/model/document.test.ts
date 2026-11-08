import { describe, expect, it } from 'vitest'
import { BACKGROUND_LAYER_NAME } from './constants'
import {
  addLayer,
  contentBounds,
  countTilesRemovedByResize,
  createDocument,
  cropDocument,
  deleteLayer,
  duplicateLayer,
  eraseTile,
  getTile,
  hasTiles,
  lineCells,
  moveLayer,
  nextShape,
  offsetTiles,
  paintTile,
  parseCanvasSize,
  resizeDocument,
  resizeOffset,
  rotateTile,
  setLayerVisible,
  trimDocument,
} from './document'
import { Shape, type TileMap } from './types'

describe('document', () => {
  it('creates a 32x32 document with only the background layer', () => {
    const doc = createDocument()
    expect(doc.width).toBe(32)
    expect(doc.height).toBe(32)
    expect(doc.layers.map((l) => l.name)).toEqual([BACKGROUND_LAYER_NAME])
  })

  it('names new layers with the next number and inserts them above the given index', () => {
    let doc = createDocument()
    const first = addLayer(doc, 0)
    doc = first.doc
    expect(first.layer.name).toBe('Layer 1')
    const second = addLayer(doc, 0)
    doc = second.doc
    expect(second.layer.name).toBe('Layer 2')
    expect(doc.layers.map((l) => l.name)).toEqual(['Background', 'Layer 2', 'Layer 1'])
  })

  it('duplicates a layer above the source without sharing tiles', () => {
    const doc = createDocument()
    paintTile(doc.layers[0]!.tiles, 1, 1, '#FF0000')
    const { doc: next, layer } = duplicateLayer(doc, 0)
    expect(next.layers.map((l) => l.name)).toEqual(['Background', 'Background copy'])
    expect(layer.tiles.size).toBe(1)
    paintTile(layer.tiles, 2, 2, '#FF0000')
    expect(doc.layers[0]!.tiles.size).toBe(1)
  })

  it('does not delete or move the background layer', () => {
    const doc = addLayer(createDocument(), 0).doc
    expect(() => deleteLayer(doc, 0)).toThrow()
    expect(() => moveLayer(doc, 0, 1)).toThrow()
    expect(() => moveLayer(doc, 1, 0)).toThrow()
    expect(deleteLayer(doc, 1).layers).toHaveLength(1)
  })

  it('moves layers', () => {
    let doc = createDocument()
    doc = addLayer(doc, 0).doc // Layer 1
    doc = addLayer(doc, 1).doc // Layer 2
    expect(doc.layers.map((l) => l.name)).toEqual(['Background', 'Layer 1', 'Layer 2'])
    doc = moveLayer(doc, 2, 1)
    expect(doc.layers.map((l) => l.name)).toEqual(['Background', 'Layer 2', 'Layer 1'])
  })

  it('validates canvas sizes', () => {
    expect(parseCanvasSize(' 12 ')).toBe(12)
    expect(parseCanvasSize(3)).toBe(3)
    expect(parseCanvasSize('0')).toBeNull()
    expect(parseCanvasSize('1.5')).toBeNull()
    expect(parseCanvasSize('')).toBeNull()
    expect(createDocument(3, 2)).toMatchObject({ width: 3, height: 2 })
    expect(() => createDocument(0, 2)).toThrow()
  })

  it('resizes around the center and removes tiles outside', () => {
    const doc = createDocument(4, 4)
    const tiles = doc.layers[0]!.tiles
    paintTile(tiles, 0, 0, '#FF0000')
    paintTile(tiles, 1, 1, '#00FF00')
    paintTile(tiles, 2, 2, '#0000FF')
    expect(countTilesRemovedByResize(doc, 2, 2)).toBe(1)
    const resized = resizeDocument(doc, 2, 2)
    expect(resized.width).toBe(2)
    expect([...resized.layers[0]!.tiles.values()].map((t) => [t.x, t.y, t.color])).toEqual([
      [0, 0, '#00FF00'],
      [1, 1, '#0000FF'],
    ])
    expect(resized.layers[0]!.id).toBe(doc.layers[0]!.id)
    expect(tiles.size).toBe(3)

    const enlarged = resizeDocument(doc, 8, 6)
    expect(getTile(enlarged.layers[0]!.tiles, 2, 1)?.color).toBe('#FF0000')
    expect(getTile(enlarged.layers[0]!.tiles, 4, 3)?.color).toBe('#0000FF')
    expect(() => resizeDocument(doc, 0, 2)).toThrow()
    expect(() => resizeDocument(doc, 1.5, 2)).toThrow()
  })

  it('adds or removes the odd column and row on the right and bottom', () => {
    const doc = createDocument(4, 4)
    paintTile(doc.layers[0]!.tiles, 0, 0, '#FF0000')
    paintTile(doc.layers[0]!.tiles, 3, 3, '#00FF00')
    const grown = resizeDocument(doc, 5, 5)
    expect(getTile(grown.layers[0]!.tiles, 0, 0)?.color).toBe('#FF0000')
    expect(getTile(grown.layers[0]!.tiles, 3, 3)?.color).toBe('#00FF00')
    const back = resizeDocument(grown, 4, 4)
    expect(getTile(back.layers[0]!.tiles, 0, 0)?.color).toBe('#FF0000')
    expect(getTile(back.layers[0]!.tiles, 3, 3)?.color).toBe('#00FF00')
    const shrunk = resizeDocument(doc, 3, 3)
    expect([...shrunk.layers[0]!.tiles.keys()]).toEqual(['0,0'])
  })

  it('resizes around the anchor', () => {
    expect(resizeOffset(4, 7, 0)).toBe(0)
    expect(resizeOffset(4, 7, 0.5)).toBe(1)
    expect(resizeOffset(4, 7, 1)).toBe(3)
    expect(resizeOffset(4, 1, 0)).toBe(0)
    expect(resizeOffset(4, 3, 0.5)).toBe(0)
    expect(resizeOffset(4, 1, 1)).toBe(-3)

    const doc = createDocument(4, 4)
    paintTile(doc.layers[0]!.tiles, 0, 0, '#FF0000')
    paintTile(doc.layers[0]!.tiles, 3, 3, '#00FF00')
    const grown = resizeDocument(doc, 6, 5, { x: 1, y: 0 })
    expect(getTile(grown.layers[0]!.tiles, 2, 0)?.color).toBe('#FF0000')
    expect(getTile(grown.layers[0]!.tiles, 5, 3)?.color).toBe('#00FF00')

    expect(countTilesRemovedByResize(doc, 2, 2, { x: 0, y: 0 })).toBe(1)
    const topLeft = resizeDocument(doc, 2, 2, { x: 0, y: 0 })
    expect([...topLeft.layers[0]!.tiles.keys()]).toEqual(['0,0'])
    const bottomRight = resizeDocument(doc, 2, 2, { x: 1, y: 1 })
    expect([...bottomRight.layers[0]!.tiles.keys()]).toEqual(['1,1'])
    const bottom = resizeDocument(doc, 4, 1, { x: 0.5, y: 1 })
    expect([...bottom.layers[0]!.tiles.keys()]).toEqual(['3,0'])
  })

  it('offsets tiles and removes those outside', () => {
    const tiles: TileMap = new Map()
    paintTile(tiles, 0, 0, '#FF0000', Shape.TopLeft)
    paintTile(tiles, 2, 1, '#00FF00')
    const moved = offsetTiles(tiles, 1, 1, { width: 3, height: 3 })
    expect([...moved.values()]).toEqual([{ x: 1, y: 1, color: '#FF0000', shape: Shape.TopLeft }])
    expect(tiles.size).toBe(2)
    expect(offsetTiles(tiles, 0, 0, { width: 3, height: 3 }).get('2,1')).toBe(tiles.get('2,1'))
  })

  it('crops to an area that may extend beyond the canvas', () => {
    const doc = createDocument(4, 4)
    paintTile(doc.layers[0]!.tiles, 1, 1, '#FF0000')
    paintTile(doc.layers[0]!.tiles, 3, 3, '#00FF00')
    const cropped = cropDocument(doc, 1, 1, 2, 2)
    expect(cropped).toMatchObject({ width: 2, height: 2 })
    expect([...cropped.layers[0]!.tiles.keys()]).toEqual(['0,0'])
    const extended = cropDocument(doc, -1, -2, 6, 6)
    expect([...extended.layers[0]!.tiles.keys()]).toEqual(['2,3', '4,5'])
    expect(() => cropDocument(doc, 0, 0, 0, 1)).toThrow()
  })

  it('trims to the tiles of all layers', () => {
    const doc = createDocument(8, 8)
    expect(hasTiles(doc)).toBe(false)
    expect(contentBounds(doc)).toBeNull()
    expect(trimDocument(doc)).toBe(doc)

    paintTile(doc.layers[0]!.tiles, 2, 3, '#FF0000')
    const withLayer = setLayerVisible(addLayer(doc, 0).doc, 1, false)
    paintTile(withLayer.layers[1]!.tiles, 5, 6, '#00FF00')
    expect(hasTiles(withLayer)).toBe(true)
    expect(contentBounds(withLayer)).toEqual({ x: 2, y: 3, width: 4, height: 4 })
    const trimmed = trimDocument(withLayer)
    expect(trimmed).toMatchObject({ width: 4, height: 4 })
    expect([...trimmed.layers[0]!.tiles.keys()]).toEqual(['0,0'])
    expect([...trimmed.layers[1]!.tiles.keys()]).toEqual(['3,3'])
    expect(trimmed.layers[1]!.visible).toBe(false)
    expect(trimDocument(trimmed)).toBe(trimmed)
  })

  it('toggles layer visibility and keeps it when duplicating', () => {
    const doc = addLayer(createDocument(), 0).doc
    expect(doc.layers.every((layer) => layer.visible)).toBe(true)
    const hidden = setLayerVisible(doc, 1, false)
    expect(hidden.layers[1]!.visible).toBe(false)
    expect(hidden.layers[1]!.id).toBe(doc.layers[1]!.id)
    expect(doc.layers[1]!.visible).toBe(true)
    expect(setLayerVisible(hidden, 1, false)).toBe(hidden)
    expect(duplicateLayer(hidden, 1).layer.visible).toBe(false)
  })

  it('places, recolors and leaves same-colored tiles unchanged', () => {
    const tiles: TileMap = new Map()
    expect(paintTile(tiles, 0, 0, '#FF0000')).toBe('placed')
    expect(getTile(tiles, 0, 0)).toEqual({ x: 0, y: 0, color: '#FF0000', shape: Shape.Square })
    rotateTile(tiles, 0, 0)
    expect(paintTile(tiles, 0, 0, '#FF0000')).toBe('unchanged')
    expect(paintTile(tiles, 0, 0, '#00FF00')).toBe('recolored')
    expect(getTile(tiles, 0, 0)).toEqual({ x: 0, y: 0, color: '#00FF00', shape: Shape.BottomRight })
    expect(paintTile(tiles, 1, 0, '#FF0000', Shape.BottomLeft)).toBe('placed')
    expect(getTile(tiles, 1, 0)?.shape).toBe(Shape.BottomLeft)
    // 既存のタイルの形状は変えない
    expect(paintTile(tiles, 0, 0, '#FF0000', Shape.BottomLeft)).toBe('recolored')
    expect(getTile(tiles, 0, 0)?.shape).toBe(Shape.BottomRight)
  })

  it('rotates shapes clockwise starting from the square', () => {
    const order = [Shape.Square, Shape.BottomRight, Shape.BottomLeft, Shape.TopLeft, Shape.TopRight]
    order.forEach((shape, i) => expect(nextShape(shape)).toBe(order[(i + 1) % order.length]))
    expect(rotateTile(new Map(), 0, 0)).toBe(false)
  })

  it('erases tiles', () => {
    const tiles: TileMap = new Map()
    paintTile(tiles, 0, 0, '#FF0000')
    expect(eraseTile(tiles, 0, 0)).toBe(true)
    expect(eraseTile(tiles, 0, 0)).toBe(false)
  })

  it('returns connected cells between two points excluding the start', () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([])
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
    const diagonal = lineCells({ x: 0, y: 0 }, { x: -2, y: 4 })
    expect(diagonal.at(-1)).toEqual({ x: -2, y: 4 })
    let previous = { x: 0, y: 0 }
    for (const cell of diagonal) {
      expect(Math.max(Math.abs(cell.x - previous.x), Math.abs(cell.y - previous.y))).toBe(1)
      previous = cell
    }
  })
})
