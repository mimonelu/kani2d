import {
  BACKGROUND_LAYER_NAME,
  CENTER_ANCHOR,
  COPY_SUFFIX,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GUIDE_SPACING,
  LAYER_NAME_PREFIX,
} from './constants'
import { countSpritesChangedByOffset, offsetSprites } from './sprites'
import {
  SHAPE_COUNT,
  SHAPE_ORDER,
  Shape,
  type AnchorPosition,
  type Cell,
  type Doc,
  type GuideSpacing,
  type Layer,
  type Rect,
  type ResizeAnchor,
  type Tile,
  type TileMap,
} from './types'

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
  return {
    width,
    height,
    guideSpacing: { width: DEFAULT_GUIDE_SPACING, height: DEFAULT_GUIDE_SPACING },
    layers: [createLayer(BACKGROUND_LAYER_NAME)],
    sprites: [],
  }
}

/** ガイドラインの間隔を変更する。変更が無い場合はそのまま返す */
export function setGuideSpacing(doc: Doc, spacing: GuideSpacing): Doc {
  if (!isValidCanvasSize(spacing.width) || !isValidCanvasSize(spacing.height)) {
    throw new RangeError(`Invalid guide spacing: ${spacing.width} x ${spacing.height}`)
  }
  if (spacing.width === doc.guideSpacing.width && spacing.height === doc.guideSpacing.height) return doc
  return { ...doc, guideSpacing: { width: spacing.width, height: spacing.height } }
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

/** レイヤーのタイルをすべて取り除く。タイルが無い場合はそのまま返す */
export function clearLayer(doc: Doc, index: number): Doc {
  const source = doc.layers[index]
  if (!source) throw new RangeError(`Layer index out of range: ${index}`)
  if (source.tiles.size === 0) return doc
  const layers = [...doc.layers]
  layers[index] = { ...source, tiles: new Map() }
  return replaceLayers(doc, layers)
}

/**
 * 基準位置を保ってリサイズした際のタイルの移動量を返す
 * - 左（上）基準では右（下）側で、右（下）基準では左（上）側で増減する
 * - 中央基準で差が奇数の場合、端数の 1 マスは右（下）側で増減する。拡大と縮小で同じ側になるため、元のサイズに戻すと元の位置に戻る
 */
export function resizeOffset(from: number, to: number, anchor: AnchorPosition = 0.5): number {
  const diff = to - from
  if (anchor === 0) return 0
  if (anchor === 1) return diff
  // Math.trunc は -0 を返すことがあるため 0 にそろえる
  return Math.trunc(diff / 2) || 0
}

/** タイルをまとめて (dx, dy) 移動した新しいマップを返す。`size` の範囲外となるタイルは削除する */
export function offsetTiles(
  tiles: TileMap,
  dx: number,
  dy: number,
  size: { readonly width: number; readonly height: number },
): TileMap {
  const result: TileMap = new Map()
  for (const tile of tiles.values()) {
    const x = tile.x + dx
    const y = tile.y + dy
    if (!isInside(size, x, y)) continue
    result.set(tileKey(x, y), dx === 0 && dy === 0 ? tile : { ...tile, x, y })
  }
  return result
}

/**
 * (left, top) を左上とする範囲でキャンバスを切り抜く。範囲はキャンバスの外を含んでもよい
 * - 範囲外となるタイルを削除する
 * - スプライトは範囲で切り詰め、範囲外となるものは削除する
 */
export function cropDocument(doc: Doc, left: number, top: number, width: number, height: number): Doc {
  if (!isValidCanvasSize(width) || !isValidCanvasSize(height)) {
    throw new RangeError(`Invalid canvas size: ${width} x ${height}`)
  }
  const size = { width, height }
  const layers = doc.layers.map((layer) => ({ ...layer, tiles: offsetTiles(layer.tiles, -left, -top, size) }))
  const sprites = offsetSprites(doc.sprites, -left, -top, size)
  return { ...doc, width, height, layers, sprites }
}

/** 基準位置を保ってリサイズし、範囲外となるタイルを削除する。スプライトは切り詰め、範囲外となるものは削除する */
export function resizeDocument(doc: Doc, width: number, height: number, anchor: ResizeAnchor = CENTER_ANCHOR): Doc {
  const dx = resizeOffset(doc.width, width, anchor.x)
  const dy = resizeOffset(doc.height, height, anchor.y)
  return cropDocument(doc, -dx, -dy, width, height)
}

/** リサイズで範囲外となるタイルの数を返す */
export function countTilesRemovedByResize(
  doc: Doc,
  width: number,
  height: number,
  anchor: ResizeAnchor = CENTER_ANCHOR,
): number {
  const dx = resizeOffset(doc.width, width, anchor.x)
  const dy = resizeOffset(doc.height, height, anchor.y)
  let count = 0
  for (const layer of doc.layers) {
    for (const tile of layer.tiles.values()) {
      if (!isInside({ width, height }, tile.x + dx, tile.y + dy)) count++
    }
  }
  return count
}

/** リサイズで切り詰められる・削除されるスプライトの数を返す */
export function countSpritesChangedByResize(
  doc: Doc,
  width: number,
  height: number,
  anchor: ResizeAnchor = CENTER_ANCHOR,
): { cropped: number; removed: number } {
  const dx = resizeOffset(doc.width, width, anchor.x)
  const dy = resizeOffset(doc.height, height, anchor.y)
  return countSpritesChangedByOffset(doc.sprites, dx, dy, { width, height })
}

export function hasTiles(doc: Doc): boolean {
  return doc.layers.some((layer) => layer.tiles.size > 0)
}

/** 自動切り抜きの基準となるタイルまたはスプライトがあるか */
export function hasContent(doc: Doc): boolean {
  return doc.sprites.length > 0 || hasTiles(doc)
}

/**
 * 全レイヤー（非表示を含む）のタイルとスプライトを囲む最小の矩形を返す。いずれも無い場合は null を返す
 * - スプライトの余白が気付かれずに切り詰められないよう、スプライトも含める
 */
export function contentBounds(doc: Doc): Rect | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const sprite of doc.sprites) {
    x0 = Math.min(x0, sprite.x)
    y0 = Math.min(y0, sprite.y)
    x1 = Math.max(x1, sprite.x + sprite.width - 1)
    y1 = Math.max(y1, sprite.y + sprite.height - 1)
  }
  for (const layer of doc.layers) {
    for (const tile of layer.tiles.values()) {
      x0 = Math.min(x0, tile.x)
      y0 = Math.min(y0, tile.y)
      x1 = Math.max(x1, tile.x)
      y1 = Math.max(y1, tile.y)
    }
  }
  if (x0 > x1) return null
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/** 全レイヤーのタイルとスプライトを囲む最小の矩形でキャンバスを切り抜く。いずれも無い場合や既に一致している場合はそのまま返す */
export function trimDocument(doc: Doc): Doc {
  const bounds = contentBounds(doc)
  if (!bounds) return doc
  if (bounds.x === 0 && bounds.y === 0 && bounds.width === doc.width && bounds.height === doc.height) return doc
  return cropDocument(doc, bounds.x, bounds.y, bounds.width, bounds.height)
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

/**
 * 塗りつぶし。(x, y) と上下左右につながるマスを塗り、変更したマスの数を返す
 * - タイルのマス: 同じ色でつながるタイルを、形状を保ったまま指定した色に置き換える
 * - 空のマス: つながる空のマスに、指定した色と形状のタイルを設置する
 * - `size` の範囲外は塗らない
 */
export function fillTiles(
  tiles: TileMap,
  size: { readonly width: number; readonly height: number },
  x: number,
  y: number,
  color: string,
  shape: Shape = Shape.Square,
): number {
  if (!isInside(size, x, y)) return 0
  /** 塗る対象の色。空のマスを塗る場合は undefined */
  const target = tiles.get(tileKey(x, y))?.color
  if (target === color) return 0
  // 塗ったマスは対象から外れるため、塗ったかどうかを別に記録しなくてよい
  const matches = (cx: number, cy: number): boolean =>
    isInside(size, cx, cy) && tiles.get(tileKey(cx, cy))?.color === target
  const fill = (cx: number, cy: number): void => {
    const key = tileKey(cx, cy)
    const current = tiles.get(key)
    tiles.set(key, current ? { ...current, color } : { x: cx, y: cy, color, shape })
  }

  // 横方向の連続したマスをまとめて塗り、上下の行の連続したマスごとに 1 つずつ起点を積む
  let count = 0
  const stack: number[] = [x, y]
  while (stack.length > 0) {
    const cy = stack.pop()!
    const cx = stack.pop()!
    if (!matches(cx, cy)) continue
    let left = cx
    while (matches(left - 1, cy)) left--
    let right = cx
    while (matches(right + 1, cy)) right++
    for (let ix = left; ix <= right; ix++) fill(ix, cy)
    count += right - left + 1
    for (const ny of [cy - 1, cy + 1]) {
      let inRun = false
      for (let ix = left; ix <= right; ix++) {
        const match = matches(ix, ny)
        if (match && !inRun) stack.push(ix, ny)
        inRun = match
      }
    }
  }
  return count
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
