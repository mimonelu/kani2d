import { SPRITE_NAME_PREFIX } from './constants'
import type { Doc, Rect, Sprite } from './types'

interface Size {
  readonly width: number
  readonly height: number
}

let spriteIdCounter = 0

export function createSpriteId(): string {
  spriteIdCounter += 1
  return `sprite-${spriteIdCounter}`
}

export function createSprite(name: string, rect: Rect): Sprite {
  return { id: createSpriteId(), name, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

/**
 * スプライト名に使えない文字
 * - 出力先の Godot のプラグインはスプライト名をファイル名に使う。`.` 以降は拡張子として除かれ、`/` はフォルダの区切りとなる
 * - それ以外は Godot や各 OS でファイル名に使えない文字
 */
export const INVALID_SPRITE_NAME_CHARS = ['.', '/', '\\', ':', '*', '?', '"', '<', '>', '|', '%'] as const

export type SpriteNameError = 'empty' | 'invalid' | 'duplicate'

/** 入力されたスプライト名から前後の空白を除く。空になる場合は undefined を返す */
export function normalizeSpriteName(input: string): string | undefined {
  const name = input.trim()
  return name === '' ? undefined : name
}

/**
 * スプライト名を検証し、問題があればその種類を返す
 * - 前後の空白は除いて判定する
 * - 名前はファイル名になり、大文字・小文字を区別しないファイルシステムもあるため、重複は大文字・小文字を区別せずに判定する
 * - `ignoreId` のスプライトとは重複してもよい
 */
export function validateSpriteName(
  sprites: readonly Sprite[],
  input: string,
  ignoreId?: string,
): SpriteNameError | null {
  const name = normalizeSpriteName(input)
  if (name === undefined) return 'empty'
  if (INVALID_SPRITE_NAME_CHARS.some((char) => name.includes(char))) return 'invalid'
  const key = name.toLowerCase()
  if (sprites.some((sprite) => sprite.id !== ignoreId && sprite.name.toLowerCase() === key)) return 'duplicate'
  return null
}

/** 既存の `sprite_N`（大文字・小文字を区別しない）の最大値 + 1 を使った名前を返す */
export function nextSpriteName(doc: Doc): string {
  const pattern = new RegExp(`^${SPRITE_NAME_PREFIX}(\\d+)$`, 'i')
  let max = 0
  for (const sprite of doc.sprites) {
    const match = pattern.exec(sprite.name)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${SPRITE_NAME_PREFIX}${max + 1}`
}

export function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** 2 つのマス (a, b) を対角とする矩形を返す */
export function rectFromCells(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1 }
}

/** 矩形が 1×1 マス以上の整数で、`size` の範囲内に収まるか */
export function isRectInside(size: Size, rect: Rect): boolean {
  return (
    Number.isSafeInteger(rect.x) &&
    Number.isSafeInteger(rect.y) &&
    Number.isSafeInteger(rect.width) &&
    Number.isSafeInteger(rect.height) &&
    rect.width >= 1 &&
    rect.height >= 1 &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= size.width &&
    rect.y + rect.height <= size.height
  )
}

/** 矩形と `size` の範囲の共通部分を返す。共通部分が無い場合は null を返す */
export function clipRect(rect: Rect, size: Size): Rect | null {
  const x0 = Math.max(0, rect.x)
  const y0 = Math.max(0, rect.y)
  const x1 = Math.min(size.width, rect.x + rect.width)
  const y1 = Math.min(size.height, rect.y + rect.height)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** (x, y) を含むスプライトを返す */
export function spriteAt(doc: Doc, x: number, y: number): Sprite | undefined {
  return doc.sprites.find((sprite) => rectContains(sprite, x, y))
}

/** 矩形をスプライトとして置けるか。キャンバス範囲内に収まり、`ignoreId` 以外のスプライトと重ならない必要がある */
export function canPlaceSprite(doc: Doc, rect: Rect, ignoreId?: string): boolean {
  return isRectInside(doc, rect) && doc.sprites.every((sprite) => sprite.id === ignoreId || !rectsOverlap(sprite, rect))
}

/** スプライトを追加する。置けない場合や名前が不正な場合は null を返す */
export function addSprite(doc: Doc, rect: Rect, name = nextSpriteName(doc)): { doc: Doc; sprite: Sprite } | null {
  if (!canPlaceSprite(doc, rect) || validateSpriteName(doc.sprites, name) !== null) return null
  const sprite = createSprite(normalizeSpriteName(name)!, rect)
  return { doc: { ...doc, sprites: [...doc.sprites, sprite] }, sprite }
}

function replaceSprite(doc: Doc, id: string, update: (sprite: Sprite) => Sprite | null): Doc {
  const index = doc.sprites.findIndex((sprite) => sprite.id === id)
  if (index < 0) return doc
  const source = doc.sprites[index]!
  const next = update(source)
  if (next === source) return doc
  const sprites = [...doc.sprites]
  if (next) {
    sprites[index] = next
  } else {
    sprites.splice(index, 1)
  }
  return { ...doc, sprites }
}

/** スプライトの位置とサイズを変更する。置けない場合や変更が無い場合はそのまま返す */
export function setSpriteRect(doc: Doc, id: string, rect: Rect): Doc {
  if (!canPlaceSprite(doc, rect, id)) return doc
  return replaceSprite(doc, id, (sprite) =>
    sameRect(sprite, rect) ? sprite : { ...sprite, x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  )
}

/** スプライトの名前を変更する。名前が不正な場合や変更が無い場合はそのまま返す */
export function renameSprite(doc: Doc, id: string, input: string): Doc {
  if (validateSpriteName(doc.sprites, input, id) !== null) return doc
  const name = normalizeSpriteName(input)!
  return replaceSprite(doc, id, (sprite) => (sprite.name === name ? sprite : { ...sprite, name }))
}

export function deleteSprite(doc: Doc, id: string): Doc {
  return replaceSprite(doc, id, () => null)
}

/** スプライトをまとめて (dx, dy) 移動し、`size` の範囲で切り詰める。範囲外となるスプライトは削除する */
export function offsetSprites(sprites: readonly Sprite[], dx: number, dy: number, size: Size): Sprite[] {
  const result: Sprite[] = []
  for (const sprite of sprites) {
    const clipped = clipRect({ x: sprite.x + dx, y: sprite.y + dy, width: sprite.width, height: sprite.height }, size)
    if (!clipped) continue
    result.push(sameRect(sprite, clipped) ? sprite : { ...sprite, ...clipped })
  }
  return result
}

/** (dx, dy) 移動して `size` の範囲で切り詰めた際に、切り詰められる・削除されるスプライトの数を返す */
export function countSpritesChangedByOffset(
  sprites: readonly Sprite[],
  dx: number,
  dy: number,
  size: Size,
): { cropped: number; removed: number } {
  let cropped = 0
  let removed = 0
  for (const sprite of sprites) {
    const moved = { x: sprite.x + dx, y: sprite.y + dy, width: sprite.width, height: sprite.height }
    const clipped = clipRect(moved, size)
    if (!clipped) {
      removed++
    } else if (!sameRect(moved, clipped)) {
      cropped++
    }
  }
  return { cropped, removed }
}
