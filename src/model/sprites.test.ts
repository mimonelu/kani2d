import { describe, expect, it } from 'vitest'
import { createDocument, paintTile, resizeDocument, countSpritesChangedByResize, trimDocument } from './document'
import {
  addSprite,
  canPlaceSprite,
  deleteSprite,
  nextSpriteName,
  rectFromCells,
  renameSprite,
  setSpriteRect,
  spriteAt,
  validateSpriteName,
} from './sprites'
import type { Doc, Rect } from './types'

function rects(doc: Doc): (Rect & { name: string })[] {
  return doc.sprites.map(({ name, x, y, width, height }) => ({ name, x, y, width, height }))
}

describe('sprites', () => {
  it('adds sprites with the next number in the name', () => {
    let doc = createDocument(8, 8)
    doc = addSprite(doc, { x: 0, y: 0, width: 2, height: 2 })!.doc
    doc = addSprite(doc, { x: 2, y: 0, width: 2, height: 2 }, 'Sprite_7')!.doc
    // 大文字・小文字を区別せずに数える
    expect(nextSpriteName(doc)).toBe('sprite_8')
    expect(rects(doc)).toEqual([
      { name: 'sprite_1', x: 0, y: 0, width: 2, height: 2 },
      { name: 'Sprite_7', x: 2, y: 0, width: 2, height: 2 },
    ])
  })

  it('rejects sprites outside the canvas or overlapping others', () => {
    const doc = addSprite(createDocument(4, 4), { x: 1, y: 1, width: 2, height: 2 })!.doc
    const id = doc.sprites[0]!.id
    expect(canPlaceSprite(doc, { x: 3, y: 3, width: 1, height: 1 })).toBe(true)
    expect(canPlaceSprite(doc, { x: 3, y: 3, width: 2, height: 1 })).toBe(false)
    expect(canPlaceSprite(doc, { x: -1, y: 0, width: 1, height: 1 })).toBe(false)
    expect(canPlaceSprite(doc, { x: 0, y: 0, width: 0, height: 1 })).toBe(false)
    expect(canPlaceSprite(doc, { x: 2, y: 2, width: 2, height: 2 })).toBe(false)
    // 自身とは重なってもよい
    expect(canPlaceSprite(doc, { x: 2, y: 2, width: 2, height: 2 }, id)).toBe(true)
    expect(addSprite(doc, { x: 0, y: 0, width: 2, height: 2 })).toBeNull()
  })

  it('moves, resizes, renames and deletes sprites', () => {
    let doc = createDocument(8, 8)
    doc = addSprite(doc, { x: 0, y: 0, width: 2, height: 2 })!.doc
    doc = addSprite(doc, { x: 4, y: 0, width: 2, height: 2 })!.doc
    const [a, b] = doc.sprites
    expect(setSpriteRect(doc, a!.id, { x: 3, y: 0, width: 2, height: 2 })).toBe(doc)
    expect(setSpriteRect(doc, a!.id, a!)).toBe(doc)
    doc = setSpriteRect(doc, a!.id, { x: 0, y: 2, width: 4, height: 3 })
    expect(rects(doc)[0]).toEqual({ name: 'sprite_1', x: 0, y: 2, width: 4, height: 3 })

    expect(renameSprite(doc, a!.id, '   ')).toBe(doc)
    doc = renameSprite(doc, a!.id, '  hero  ')
    expect(renameSprite(doc, b!.id, 'HERO')).toBe(doc)
    expect(renameSprite(doc, b!.id, 'hero.png')).toBe(doc)
    // 自身の名前の大文字・小文字は変えられる
    doc = renameSprite(doc, a!.id, 'Hero')
    expect(doc.sprites.map((sprite) => sprite.name)).toEqual(['Hero', 'sprite_2'])

    doc = deleteSprite(doc, a!.id)
    expect(doc.sprites.map((sprite) => sprite.id)).toEqual([b!.id])
    expect(deleteSprite(doc, a!.id)).toBe(doc)
  })

  it('validates sprite names for use as file names', () => {
    const doc = addSprite(createDocument(8, 8), { x: 0, y: 0, width: 1, height: 1 }, 'walk_1')!.doc
    const id = doc.sprites[0]!.id
    expect(validateSpriteName(doc.sprites, ' walk_2 ')).toBeNull()
    expect(validateSpriteName(doc.sprites, ' ')).toBe('empty')
    for (const char of ['.', '/', '\\', ':', '*', '?', '"', '<', '>', '|', '%']) {
      expect(validateSpriteName(doc.sprites, `a${char}b`)).toBe('invalid')
    }
    expect(validateSpriteName(doc.sprites, 'WALK_1')).toBe('duplicate')
    expect(validateSpriteName(doc.sprites, 'WALK_1', id)).toBeNull()
    expect(addSprite(doc, { x: 1, y: 0, width: 1, height: 1 }, 'Walk_1')).toBeNull()
  })

  it('finds sprites by cell and builds rects from two cells', () => {
    const doc = addSprite(createDocument(8, 8), { x: 2, y: 3, width: 2, height: 1 })!.doc
    expect(spriteAt(doc, 3, 3)?.id).toBe(doc.sprites[0]!.id)
    expect(spriteAt(doc, 4, 3)).toBeUndefined()
    expect(rectFromCells({ x: 5, y: 1 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 1, width: 4, height: 4 })
  })

  it('crops sprites when resizing and removes those outside', () => {
    let doc = createDocument(8, 8)
    doc = addSprite(doc, { x: 0, y: 0, width: 2, height: 2 })!.doc
    doc = addSprite(doc, { x: 3, y: 3, width: 4, height: 2 })!.doc
    const anchor = { x: 0, y: 0 } as const
    expect(countSpritesChangedByResize(doc, 5, 8, anchor)).toEqual({ cropped: 1, removed: 0 })
    expect(rects(resizeDocument(doc, 5, 8, anchor))).toEqual([
      { name: 'sprite_1', x: 0, y: 0, width: 2, height: 2 },
      { name: 'sprite_2', x: 3, y: 3, width: 2, height: 2 },
    ])
    expect(countSpritesChangedByResize(doc, 3, 3, anchor)).toEqual({ cropped: 0, removed: 1 })
    expect(rects(resizeDocument(doc, 3, 3, anchor))).toEqual([{ name: 'sprite_1', x: 0, y: 0, width: 2, height: 2 }])
    // 基準位置に合わせて移動する
    expect(rects(resizeDocument(doc, 10, 10))[0]).toEqual({ name: 'sprite_1', x: 1, y: 1, width: 2, height: 2 })
  })

  it('trims to the tiles and sprites', () => {
    let doc = createDocument(8, 8)
    paintTile(doc.layers[0]!.tiles, 5, 5, '#FFFFFF')
    doc = addSprite(doc, { x: 2, y: 3, width: 2, height: 1 })!.doc
    const trimmed = trimDocument(doc)
    expect([trimmed.width, trimmed.height]).toEqual([4, 3])
    expect(rects(trimmed)).toEqual([{ name: 'sprite_1', x: 0, y: 0, width: 2, height: 1 }])
    expect([...trimmed.layers[0]!.tiles.keys()]).toEqual(['3,2'])

    // タイルが無くてもスプライトを基準に切り抜く
    const spritesOnly = trimDocument(addSprite(createDocument(8, 8), { x: 1, y: 1, width: 3, height: 2 })!.doc)
    expect([spritesOnly.width, spritesOnly.height]).toEqual([3, 2])
  })
})
