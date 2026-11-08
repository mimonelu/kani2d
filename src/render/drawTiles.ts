import { Shape, type Layer } from '../model/types'

export const CANVAS_COLORS = {
  outside: '#141518',
  checkerLight: '#333438',
  checkerDark: '#26272a',
  guide: 'rgba(170, 170, 176, 0.55)',
  guideLine: 'rgba(170, 170, 176, 0.35)',
  border: 'rgba(255, 255, 255, 0.18)',
  hover: 'rgba(255, 255, 255, 0.75)',
  eraseHover: 'rgba(240, 90, 80, 0.9)',
} as const

/** マスの左上 (x0, y0) と右下 (x1, y1) で表した矩形に形状のパスを追加する */
export function appendShapePath(path: Path2D, shape: Shape, x0: number, y0: number, x1: number, y1: number): void {
  switch (shape) {
    case Shape.Square:
      path.rect(x0, y0, x1 - x0, y1 - y0)
      return
    case Shape.TopLeft:
      path.moveTo(x0, y0)
      path.lineTo(x1, y0)
      path.lineTo(x0, y1)
      break
    case Shape.TopRight:
      path.moveTo(x0, y0)
      path.lineTo(x1, y0)
      path.lineTo(x1, y1)
      break
    case Shape.BottomRight:
      path.moveTo(x1, y0)
      path.lineTo(x1, y1)
      path.lineTo(x0, y1)
      break
    case Shape.BottomLeft:
      path.moveTo(x0, y0)
      path.lineTo(x1, y1)
      path.lineTo(x0, y1)
      break
  }
  path.closePath()
}

export interface CellRange {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * レイヤーのタイルを描画する
 * - 同じ色のタイルを 1 つのパスにまとめて塗ることで、隣接するタイル間の継ぎ目を防ぐ
 * - `mapX` / `mapY` はマス座標を描画先の座標に変換する
 */
export function drawLayerTiles(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  mapX: (x: number) => number,
  mapY: (y: number) => number,
  range?: CellRange,
): void {
  const paths = new Map<string, Path2D>()
  for (const tile of layer.tiles.values()) {
    if (range && (tile.x < range.x0 || tile.x > range.x1 || tile.y < range.y0 || tile.y > range.y1)) continue
    let path = paths.get(tile.color)
    if (!path) {
      path = new Path2D()
      paths.set(tile.color, path)
    }
    appendShapePath(path, tile.shape, mapX(tile.x), mapY(tile.y), mapX(tile.x + 1), mapY(tile.y + 1))
  }
  for (const [color, path] of paths) {
    ctx.fillStyle = color
    ctx.fill(path)
  }
}

const checkerCache = new Map<string, HTMLCanvasElement>()

/** 透明を表す市松模様のタイル（2×2 マス分）を返す */
export function getCheckerTile(cellSize: number): HTMLCanvasElement {
  const size = Math.max(1, Math.round(cellSize))
  const key = String(size)
  const cached = checkerCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = CANVAS_COLORS.checkerDark
  ctx.fillRect(0, 0, size * 2, size * 2)
  ctx.fillStyle = CANVAS_COLORS.checkerLight
  ctx.fillRect(0, 0, size, size)
  ctx.fillRect(size, size, size, size)
  checkerCache.set(key, canvas)
  return canvas
}

/** 市松模様で矩形を塗る。(originX, originY) を模様の基準位置とする */
export function fillChecker(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  originX: number,
  originY: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const pattern = ctx.createPattern(getCheckerTile(cellSize), 'repeat')
  if (!pattern) return
  pattern.setTransform(new DOMMatrix([1, 0, 0, 1, originX, originY]))
  ctx.fillStyle = pattern
  ctx.fillRect(x, y, width, height)
}
