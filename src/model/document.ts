import {
  BACKGROUND_LAYER_NAME,
  COPY_SUFFIX,
  DEFAULT_CANVAS_SIZE,
  LAYER_NAME_PREFIX,
} from './constants'
import { SHAPE_COUNT, Shape, type Cell, type Doc, type Layer, type Tile, type TileMap } from './types'

let layerIdCounter = 0

export function createLayerId(): string {
  layerIdCounter += 1
  return `layer-${layerIdCounter}`
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

export function createLayer(name: string, tiles: TileMap = new Map()): Layer {
  return { id: createLayerId(), name, tiles }
}

export function createDocument(width = DEFAULT_CANVAS_SIZE, height = DEFAULT_CANVAS_SIZE): Doc {
  return { width, height, layers: [createLayer(BACKGROUND_LAYER_NAME)] }
}

export function isValidCanvasSize(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1
}

export function isInside(doc: Doc, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < doc.width && y < doc.height
}

function replaceLayers(doc: Doc, layers: readonly Layer[]): Doc {
  return { ...doc, layers }
}

/** 既存の `Layer N` の最大値 + 1 を使った名前を返す */
export function nextLayerName(doc: Doc): string {
  const pattern = new RegExp(`^${LAYER_NAME_PREFIX} (\\d+)$`)
  let max = 0
  for (const layer of doc.layers) {
    const match = pattern.exec(layer.name)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${LAYER_NAME_PREFIX} ${max + 1}`
}

/** `index` の直上に新規レイヤーを作成する */
export function addLayer(doc: Doc, index: number): { doc: Doc; layer: Layer } {
  const layer = createLayer(nextLayerName(doc))
  const layers = [...doc.layers]
  layers.splice(index + 1, 0, layer)
  return { doc: replaceLayers(doc, layers), layer }
}

/** `index` のレイヤーを複製し、その直上に置く */
export function duplicateLayer(doc: Doc, index: number): { doc: Doc; layer: Layer } {
  const source = doc.layers[index]
  if (!source) throw new RangeError(`Layer index out of range: ${index}`)
  const layer = createLayer(`${source.name} ${COPY_SUFFIX}`, new Map(source.tiles))
  const layers = [...doc.layers]
  layers.splice(index + 1, 0, layer)
  return { doc: replaceLayers(doc, layers), layer }
}

/** 背景レイヤー（index 0）は削除できない */
export function deleteLayer(doc: Doc, index: number): Doc {
  if (index <= 0 || index >= doc.layers.length) {
    throw new RangeError(`Cannot delete layer at index ${index}`)
  }
  const layers = [...doc.layers]
  layers.splice(index, 1)
  return replaceLayers(doc, layers)
}

/** `from` のレイヤーを取り除き、結果の配列で `to` の位置に挿入する。背景レイヤーは動かせない */
export function moveLayer(doc: Doc, from: number, to: number): Doc {
  const last = doc.layers.length - 1
  if (from <= 0 || from > last || to <= 0 || to > last) {
    throw new RangeError(`Cannot move layer from ${from} to ${to}`)
  }
  if (from === to) return doc
  const layers = [...doc.layers]
  const [layer] = layers.splice(from, 1)
  layers.splice(to, 0, layer!)
  return replaceLayers(doc, layers)
}

/** 左上を基準にリサイズし、範囲外となるタイルを削除する */
export function resizeDocument(doc: Doc, width: number, height: number): Doc {
  if (!isValidCanvasSize(width) || !isValidCanvasSize(height)) {
    throw new RangeError(`Invalid canvas size: ${width} x ${height}`)
  }
  const layers = doc.layers.map((layer) => {
    const tiles: TileMap = new Map()
    for (const [key, tile] of layer.tiles) {
      if (tile.x < width && tile.y < height) tiles.set(key, tile)
    }
    return { ...layer, tiles }
  })
  return { width, height, layers }
}

export function nextShape(shape: Shape): Shape {
  return ((shape + 1) % SHAPE_COUNT) as Shape
}

export type PaintResult = 'placed' | 'recolored' | 'unchanged'

/** 空なら四角を設置し、異なる色なら形状を保ったまま色を置き換える */
export function paintTile(tiles: TileMap, x: number, y: number, color: string): PaintResult {
  const key = tileKey(x, y)
  const current = tiles.get(key)
  if (!current) {
    tiles.set(key, { x, y, color, shape: Shape.Square })
    return 'placed'
  }
  if (current.color === color) return 'unchanged'
  tiles.set(key, { ...current, color })
  return 'recolored'
}

export function rotateTile(tiles: TileMap, x: number, y: number): boolean {
  const key = tileKey(x, y)
  const current = tiles.get(key)
  if (!current) return false
  tiles.set(key, { ...current, shape: nextShape(current.shape) })
  return true
}

export function eraseTile(tiles: TileMap, x: number, y: number): boolean {
  return tiles.delete(tileKey(x, y))
}

export function getTile(tiles: TileMap, x: number, y: number): Tile | undefined {
  return tiles.get(tileKey(x, y))
}

/** 2 マス間を結ぶマスを始点を除いて返す（ブレゼンハムのアルゴリズム） */
export function lineCells(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = []
  let { x, y } = from
  const dx = Math.abs(to.x - x)
  const dy = -Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1
  const sy = y < to.y ? 1 : -1
  let error = dx + dy
  while (x !== to.x || y !== to.y) {
    const e2 = error * 2
    if (e2 >= dy) {
      error += dy
      x += sx
    }
    if (e2 <= dx) {
      error += dx
      y += sy
    }
    cells.push({ x, y })
  }
  return cells
}
