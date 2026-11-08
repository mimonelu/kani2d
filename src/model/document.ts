import {
  BACKGROUND_LAYER_NAME,
  COPY_SUFFIX,
  DEFAULT_CANVAS_SIZE,
  LAYER_NAME_PREFIX,
} from './constants'
import { SHAPE_COUNT, SHAPE_ORDER, Shape, type Cell, type Doc, type Layer, type Tile, type TileMap } from './types'

let layerIdCounter = 0

export function createLayerId(): string {
  layerIdCounter += 1
  return `layer-${layerIdCounter}`
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

export function createLayer(name: string, tiles: TileMap = new Map(), visible = true): Layer {
  return { id: createLayerId(), name, visible, tiles }
}

export function isValidCanvasSize(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1
}

/** 入力されたキャンバスサイズ（1 以上の整数）を数値にする。不正な場合は null を返す */
export function parseCanvasSize(input: string | number): number | null {
  const text = String(input).trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return isValidCanvasSize(value) ? value : null
}

export function createDocument(width = DEFAULT_CANVAS_SIZE, height = DEFAULT_CANVAS_SIZE): Doc {
  if (!isValidCanvasSize(width) || !isValidCanvasSize(height)) {
    throw new RangeError(`Invalid canvas size: ${width} x ${height}`)
  }
  return { width, height, layers: [createLayer(BACKGROUND_LAYER_NAME)] }
}

export function isInside(size: { readonly width: number; readonly height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size.width && y < size.height
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
  const layer = createLayer(`${source.name} ${COPY_SUFFIX}`, new Map(source.tiles), source.visible)
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

export function setLayerVisible(doc: Doc, index: number, visible: boolean): Doc {
  const source = doc.layers[index]
  if (!source) throw new RangeError(`Layer index out of range: ${index}`)
  if (source.visible === visible) return doc
  const layers = [...doc.layers]
  layers[index] = { ...source, visible }
  return replaceLayers(doc, layers)
}

/**
 * 中心を基準にリサイズした際のタイルの移動量を返す
 * - 差が奇数の場合、端数の 1 マスは右（下）側で増減する。拡大と縮小で同じ側になるため、元のサイズに戻すと元の位置に戻る
 */
export function resizeOffset(from: number, to: number): number {
  return Math.trunc((to - from) / 2)
}

/** 中心を基準にリサイズし、範囲外となるタイルを削除する */
export function resizeDocument(doc: Doc, width: number, height: number): Doc {
  if (!isValidCanvasSize(width) || !isValidCanvasSize(height)) {
    throw new RangeError(`Invalid canvas size: ${width} x ${height}`)
  }
  const dx = resizeOffset(doc.width, width)
  const dy = resizeOffset(doc.height, height)
  const layers = doc.layers.map((layer) => {
    const tiles: TileMap = new Map()
    for (const tile of layer.tiles.values()) {
      const x = tile.x + dx
      const y = tile.y + dy
      if (!isInside({ width, height }, x, y)) continue
      tiles.set(tileKey(x, y), dx === 0 && dy === 0 ? tile : { ...tile, x, y })
    }
    return { ...layer, tiles }
  })
  return { width, height, layers }
}

/** リサイズで範囲外となるタイルの数を返す */
export function countTilesRemovedByResize(doc: Doc, width: number, height: number): number {
  const dx = resizeOffset(doc.width, width)
  const dy = resizeOffset(doc.height, height)
  let count = 0
  for (const layer of doc.layers) {
    for (const tile of layer.tiles.values()) {
      if (!isInside({ width, height }, tile.x + dx, tile.y + dy)) count++
    }
  }
  return count
}

export function isShape(value: unknown): value is Shape {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SHAPE_COUNT
}

/** `SHAPE_ORDER` の順で次の形状を返す */
export function nextShape(shape: Shape): Shape {
  return SHAPE_ORDER[(SHAPE_ORDER.indexOf(shape) + 1) % SHAPE_ORDER.length]!
}

export type PaintResult = 'placed' | 'recolored' | 'unchanged'

/** 空なら指定した形状のタイルを設置し、異なる色なら形状を保ったまま色を置き換える */
export function paintTile(
  tiles: TileMap,
  x: number,
  y: number,
  color: string,
  shape: Shape = Shape.Square,
): PaintResult {
  const key = tileKey(x, y)
  const current = tiles.get(key)
  if (!current) {
    tiles.set(key, { x, y, color, shape })
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
