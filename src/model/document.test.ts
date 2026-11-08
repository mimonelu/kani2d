import { describe, expect, it } from 'vitest'
import { BACKGROUND_LAYER_NAME } from './constants'
import {
  addLayer,
  createDocument,
  deleteLayer,
  duplicateLayer,
  eraseTile,
  getTile,
  lineCells,
  moveLayer,
  nextShape,
  paintTile,
  resizeDocument,
  rotateTile,
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

  it('resizes from the top-left corner and removes tiles outside', () => {
    const doc = createDocument(4, 4)
    const tiles = doc.layers[0]!.tiles
    paintTile(tiles, 0, 0, '#FF0000')
    paintTile(tiles, 3, 3, '#FF0000')
    const resized = resizeDocument(doc, 2, 2)
    expect(resized.width).toBe(2)
    expect(resized.layers[0]!.tiles.size).toBe(1)
    expect(resized.layers[0]!.id).toBe(doc.layers[0]!.id)
    expect(tiles.size).toBe(2)
    expect(() => resizeDocument(doc, 0, 2)).toThrow()
    expect(() => resizeDocument(doc, 1.5, 2)).toThrow()
  })

  it('places, recolors and leaves same-colored tiles unchanged', () => {
    const tiles: TileMap = new Map()
    expect(paintTile(tiles, 0, 0, '#FF0000')).toBe('placed')
    expect(getTile(tiles, 0, 0)).toEqual({ x: 0, y: 0, color: '#FF0000', shape: Shape.Square })
    rotateTile(tiles, 0, 0)
    expect(paintTile(tiles, 0, 0, '#FF0000')).toBe('unchanged')
    expect(paintTile(tiles, 0, 0, '#00FF00')).toBe('recolored')
    expect(getTile(tiles, 0, 0)).toEqual({ x: 0, y: 0, color: '#00FF00', shape: Shape.TopLeft })
  })

  it('rotates shapes clockwise starting from the square', () => {
    const order = [Shape.Square, Shape.TopLeft, Shape.TopRight, Shape.BottomRight, Shape.BottomLeft]
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
