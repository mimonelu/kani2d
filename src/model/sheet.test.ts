import { describe, expect, it } from 'vitest'
import { createDocument } from './document'
import { createSheetData } from './sheet'
import { addSprite } from './sprites'

describe('sheet', () => {
  it('creates TexturePacker Godot SpriteSheet data sorted by name', () => {
    let doc = createDocument(8, 4)
    doc = addSprite(doc, { x: 4, y: 0, width: 4, height: 2 }, 'walk_10')!.doc
    doc = addSprite(doc, { x: 2, y: 0, width: 2, height: 2 }, 'walk_2')!.doc
    doc = addSprite(doc, { x: 0, y: 2, width: 1, height: 1 }, 'idle')!.doc
    expect(createSheetData(doc, 16, 'chara.png')).toEqual({
      textures: [
        {
          image: 'chara.png',
          size: { w: 128, h: 64 },
          sprites: [
            { filename: 'idle', region: { x: 0, y: 32, w: 16, h: 16 }, margin: { x: 0, y: 0, w: 0, h: 0 } },
            { filename: 'walk_2', region: { x: 32, y: 0, w: 32, h: 32 }, margin: { x: 0, y: 0, w: 0, h: 0 } },
            { filename: 'walk_10', region: { x: 64, y: 0, w: 64, h: 32 }, margin: { x: 0, y: 0, w: 0, h: 0 } },
          ],
        },
      ],
      meta: { app: 'Kani2D' },
    })
  })
})
