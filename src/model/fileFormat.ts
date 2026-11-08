import { BACKGROUND_LAYER_NAME, FILE_FORMAT_ID, FILE_FORMAT_VERSION } from './constants'
import { createLayer, isValidCanvasSize, tileKey } from './document'
import { COLOR_PATTERN } from './palette'
import { SHAPE_COUNT, type Doc, type Shape, type TileMap } from './types'

/** `[x, y, 色, 形状]` */
export type SerializedTile = [number, number, string, Shape]

export interface SerializedLayer {
  name: string
  tiles: SerializedTile[]
}

export interface SerializedDoc {
  format: typeof FILE_FORMAT_ID
  version: typeof FILE_FORMAT_VERSION
  width: number
  height: number
  /** 背面から前面の順 */
  layers: SerializedLayer[]
}

export class FileFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileFormatError'
  }
}

export function serializeTiles(tiles: TileMap): SerializedTile[] {
  return [...tiles.values()]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((tile) => [tile.x, tile.y, tile.color, tile.shape])
}

export function toSerialized(doc: Doc): SerializedDoc {
  return {
    format: FILE_FORMAT_ID,
    version: FILE_FORMAT_VERSION,
    width: doc.width,
    height: doc.height,
    layers: doc.layers.map((layer) => ({ name: layer.name, tiles: serializeTiles(layer.tiles) })),
  }
}

export function serializeDocument(doc: Doc): string {
  return JSON.stringify(toSerialized(doc))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function parseTiles(value: unknown, width: number, height: number, layerIndex: number): TileMap {
  if (!Array.isArray(value)) {
    throw new FileFormatError(`Layer ${layerIndex + 1} has no tile list.`)
  }
  const tiles: TileMap = new Map()
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 4) {
      throw new FileFormatError(`Layer ${layerIndex + 1} contains an invalid tile.`)
    }
    const [x, y, rawColor, shape] = item as unknown[]
    if (!isInteger(x) || !isInteger(y)) {
      throw new FileFormatError(`Layer ${layerIndex + 1} contains a tile with invalid coordinates.`)
    }
    const color = typeof rawColor === 'string' ? rawColor.toUpperCase() : ''
    if (!COLOR_PATTERN.test(color)) {
      throw new FileFormatError(`Layer ${layerIndex + 1} contains a tile with an invalid color.`)
    }
    if (!isInteger(shape) || shape < 0 || shape >= SHAPE_COUNT) {
      throw new FileFormatError(`Layer ${layerIndex + 1} contains a tile with an invalid shape.`)
    }
    // キャンバス範囲外のタイルは無視する
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    tiles.set(tileKey(x, y), { x, y, color, shape: shape as Shape })
  }
  return tiles
}

export function parseDocument(text: string): Doc {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new FileFormatError('The file is not valid JSON.')
  }
  if (!isRecord(data) || data.format !== FILE_FORMAT_ID) {
    throw new FileFormatError('The file is not a Kani2D file.')
  }
  if (!isInteger(data.version) || data.version < 1) {
    throw new FileFormatError('The file has an invalid version.')
  }
  if (data.version > FILE_FORMAT_VERSION) {
    throw new FileFormatError(
      `The file version ${data.version} is not supported. Please use a newer version of Kani2D.`,
    )
  }
  const { width, height } = data
  if (!isInteger(width) || !isInteger(height) || !isValidCanvasSize(width) || !isValidCanvasSize(height)) {
    throw new FileFormatError('The file has an invalid canvas size.')
  }
  if (!Array.isArray(data.layers) || data.layers.length === 0) {
    throw new FileFormatError('The file has no layers.')
  }
  const layers = data.layers.map((raw: unknown, index: number) => {
    if (!isRecord(raw) || typeof raw.name !== 'string') {
      throw new FileFormatError(`Layer ${index + 1} is invalid.`)
    }
    const tiles = parseTiles(raw.tiles, width, height, index)
    // 先頭は名前によらず背景レイヤーとして扱う
    return createLayer(index === 0 ? BACKGROUND_LAYER_NAME : raw.name, tiles)
  })
  return { width, height, layers }
}

/** ファイル名から拡張子を除いた部分を返す */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}
