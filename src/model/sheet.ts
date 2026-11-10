import { APP_NAME } from './constants'
import type { Doc, Sprite } from './types'

/** スプライトシートの情報のファイルの拡張子。Godot の TexturePacker Importer が読み込む */
export const SHEET_EXTENSION = '.tpsheet'

interface SheetRect {
  x: number
  y: number
  w: number
  h: number
}

export interface SheetSprite {
  filename: string
  region: SheetRect
  /** トリミングしないため常に 0 */
  margin: SheetRect
}

/** TexturePacker の Godot SpriteSheet 形式（`.tpsheet`） */
export interface SheetData {
  textures: {
    image: string
    size: { w: number; h: number }
    sprites: SheetSprite[]
  }[]
  meta: {
    app: string
  }
}

const nameCollator = new Intl.Collator('en', { numeric: true })

/** 名前の順（数字は数値として比較する） */
export function compareSprites(a: Sprite, b: Sprite): number {
  return nameCollator.compare(a.name, b.name) || a.y - b.y || a.x - b.x
}

/**
 * スプライトシートの情報を TexturePacker の Godot SpriteSheet 形式で作る
 * - 位置とサイズは出力画像のピクセル単位とする
 * - `imageName` は出力画像のファイル名。`.tpsheet` と同じフォルダに置く前提とする
 */
export function createSheetData(doc: Doc, tileSize: number, imageName: string): SheetData {
  const sprites = [...doc.sprites].sort(compareSprites).map(
    (sprite): SheetSprite => ({
      filename: sprite.name,
      region: {
        x: sprite.x * tileSize,
        y: sprite.y * tileSize,
        w: sprite.width * tileSize,
        h: sprite.height * tileSize,
      },
      margin: { x: 0, y: 0, w: 0, h: 0 },
    }),
  )
  return {
    textures: [{ image: imageName, size: { w: doc.width * tileSize, h: doc.height * tileSize }, sprites }],
    meta: { app: APP_NAME },
  }
}

export function serializeSheetData(data: SheetData): string {
  return `${JSON.stringify(data, null, 2)}\n`
}
