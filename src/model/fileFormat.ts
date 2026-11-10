import {
  BACKGROUND_LAYER_NAME,
  DEFAULT_GUIDE_SPACING,
  FILE_EXTENSION,
  FILE_FORMAT_ID,
  FILE_FORMAT_VERSION,
} from './constants'
import { createLayer, isShape, isValidCanvasSize, tileKey } from './document'
import { COLOR_PATTERN } from './palette'
import { clipRect, createSprite, normalizeSpriteName, rectsOverlap, validateSpriteName } from './sprites'
import type { Doc, GuideSpacing, Shape, Sprite, TileMap } from './types'

/** `[x, y, 色, 形状]` */
export type SerializedTile = [number, number, string, Shape]

export interface SerializedLayer {
  name: string
  /** バージョン 2 で追加。省略時は表示とみなす */
  visible: boolean
  tiles: SerializedTile[]
}

/** 位置とサイズの単位はマス */
export interface SerializedSprite {
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface SerializedDoc {
  format: typeof FILE_FORMAT_ID
  version: typeof FILE_FORMAT_VERSION
  width: number
  height: number
  /** ガイドラインの間隔（マス）。バージョン 3 で追加。省略時は 16×16 とみなす */
  guideSpacing: { width: number; height: number }
  /** 背面から前面の順 */
  layers: SerializedLayer[]
  /** スプライトシートの各スプライト。バージョン 4 で追加。省略時は無いものとみなす */
  sprites: SerializedSprite[]
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
    guideSpacing: { width: doc.guideSpacing.width, height: doc.guideSpacing.height },
    layers: doc.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      tiles: serializeTiles(layer.tiles),
    })),
    sprites: doc.sprites.map(({ name, x, y, width, height }) => ({ name, x, y, width, height })),
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
    if (!isShape(shape)) {
      throw new FileFormatError(`Layer ${layerIndex + 1} contains a tile with an invalid shape.`)
    }
    // キャンバス範囲外のタイルは無視する
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    tiles.set(tileKey(x, y), { x, y, color, shape })
  }
  return tiles
}

function parseGuideSpacing(value: unknown): GuideSpacing {
  if (value === undefined) return { width: DEFAULT_GUIDE_SPACING, height: DEFAULT_GUIDE_SPACING }
  if (
    !isRecord(value) ||
    !isInteger(value.width) ||
    !isInteger(value.height) ||
    !isValidCanvasSize(value.width) ||
    !isValidCanvasSize(value.height)
  ) {
    throw new FileFormatError('The file has an invalid guide spacing.')
  }
  return { width: value.width, height: value.height }
}

/** キャンバス範囲からはみ出す部分は切り詰め、範囲外のスプライトは無視する */
function parseSprites(value: unknown, width: number, height: number): Sprite[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new FileFormatError('The file has an invalid sprite list.')
  const sprites: Sprite[] = []
  value.forEach((raw: unknown, index: number) => {
    if (
      !isRecord(raw) ||
      typeof raw.name !== 'string' ||
      !isInteger(raw.x) ||
      !isInteger(raw.y) ||
      !isInteger(raw.width) ||
      !isInteger(raw.height) ||
      raw.width < 1 ||
      raw.height < 1
    ) {
      throw new FileFormatError(`Sprite ${index + 1} is invalid.`)
    }
    // 範囲外で無視するスプライトとの重複は問題にならないため、範囲内のものとのみ比較する
    const nameError = validateSpriteName(sprites, raw.name)
    if (nameError === 'empty' || nameError === 'invalid') {
      throw new FileFormatError(`Sprite ${index + 1} has an invalid name.`)
    }
    const rect = clipRect({ x: raw.x, y: raw.y, width: raw.width, height: raw.height }, { width, height })
    if (!rect) return
    if (nameError === 'duplicate') {
      throw new FileFormatError(`Sprite ${index + 1} has the same name as another sprite.`)
    }
    if (sprites.some((sprite) => rectsOverlap(sprite, rect))) {
      throw new FileFormatError(`Sprite ${index + 1} overlaps another sprite.`)
    }
    sprites.push(createSprite(normalizeSpriteName(raw.name)!, rect))
  })
  return sprites
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
  const guideSpacing = parseGuideSpacing(data.guideSpacing)
  if (!Array.isArray(data.layers) || data.layers.length === 0) {
    throw new FileFormatError('The file has no layers.')
  }
  const layers = data.layers.map((raw: unknown, index: number) => {
    if (
      !isRecord(raw) ||
      typeof raw.name !== 'string' ||
      (raw.visible !== undefined && typeof raw.visible !== 'boolean')
    ) {
      throw new FileFormatError(`Layer ${index + 1} is invalid.`)
    }
    const tiles = parseTiles(raw.tiles, width, height, index)
    // 先頭は名前によらず背景レイヤーとして扱う
    return createLayer(index === 0 ? BACKGROUND_LAYER_NAME : raw.name, tiles, raw.visible !== false)
  })
  const sprites = parseSprites(data.sprites, width, height)
  return { width, height, guideSpacing, layers, sprites }
}

/** ファイル名から拡張子を除いた部分を返す */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/** 入力されたファイル名から前後の空白と独自形式の拡張子を除く。空になる場合は undefined を返す */
export function normalizeFileName(input: string): string | undefined {
  let name = input.trim()
  if (name.toLowerCase().endsWith(FILE_EXTENSION)) name = name.slice(0, -FILE_EXTENSION.length).trim()
  return name === '' ? undefined : name
}
