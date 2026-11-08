import { describe, expect, it } from 'vitest'
import { addLayer, createDocument, paintTile, rotateTile, setLayerVisible } from './document'
import { FileFormatError, baseName, normalizeFileName, parseDocument, serializeDocument, toSerialized } from './fileFormat'

function sample() {
  let doc = createDocument(8, 4)
  paintTile(doc.layers[0]!.tiles, 1, 2, '#FF0000')
  doc = addLayer(doc, 0).doc
  paintTile(doc.layers[1]!.tiles, 7, 3, '#0040C0')
  rotateTile(doc.layers[1]!.tiles, 7, 3)
  return setLayerVisible(doc, 1, false)
}

describe('fileFormat', () => {
  it('serializes to the documented structure', () => {
    expect(toSerialized(sample())).toEqual({
      format: 'kani2d',
      version: 2,
      width: 8,
      height: 4,
      layers: [
        { name: 'Background', visible: true, tiles: [[1, 2, '#FF0000', 0]] },
        { name: 'Layer 1', visible: false, tiles: [[7, 3, '#0040C0', 3]] },
      ],
    })
  })

  it('round-trips a document', () => {
    const doc = sample()
    const parsed = parseDocument(serializeDocument(doc))
    expect(toSerialized(parsed)).toEqual(toSerialized(doc))
  })

  it('reads version 1 files and treats their layers as visible', () => {
    const parsed = parseDocument(
      JSON.stringify({
        format: 'kani2d',
        version: 1,
        width: 2,
        height: 2,
        layers: [
          { name: 'Background', tiles: [[0, 0, '#FFFFFF', 0]] },
          { name: 'Layer 1', tiles: [] },
        ],
      }),
    )
    expect(parsed.layers.map((layer) => layer.visible)).toEqual([true, true])
    expect(parsed.layers[0]!.tiles.size).toBe(1)
  })

  it('ignores tiles outside the canvas and normalizes colors', () => {
    const parsed = parseDocument(
      JSON.stringify({
        format: 'kani2d',
        version: 1,
        width: 2,
        height: 2,
        layers: [{ name: 'Anything', tiles: [[0, 0, '#ff00aa', 4], [2, 0, '#FFFFFF', 0], [-1, 0, '#FFFFFF', 0]] }],
      }),
    )
    expect(parsed.layers[0]!.name).toBe('Background')
    expect([...parsed.layers[0]!.tiles.values()]).toEqual([{ x: 0, y: 0, color: '#FF00AA', shape: 4 }])
  })

  it.each([
    ['not json', '{'],
    ['wrong format', JSON.stringify({ format: 'other', version: 1, width: 1, height: 1, layers: [] })],
    ['newer version', JSON.stringify({ format: 'kani2d', version: 3, width: 1, height: 1, layers: [] })],
    ['invalid size', JSON.stringify({ format: 'kani2d', version: 1, width: 0, height: 1, layers: [] })],
    ['no layers', JSON.stringify({ format: 'kani2d', version: 1, width: 1, height: 1, layers: [] })],
    [
      'invalid shape',
      JSON.stringify({ format: 'kani2d', version: 1, width: 1, height: 1, layers: [{ name: 'a', tiles: [[0, 0, '#FFFFFF', 5]] }] }),
    ],
    [
      'invalid visibility',
      JSON.stringify({ format: 'kani2d', version: 2, width: 1, height: 1, layers: [{ name: 'a', visible: 'no', tiles: [] }] }),
    ],
    [
      'invalid color',
      JSON.stringify({ format: 'kani2d', version: 1, width: 1, height: 1, layers: [{ name: 'a', tiles: [[0, 0, 'red', 0]] }] }),
    ],
  ])('rejects %s', (_, text) => {
    expect(() => parseDocument(text)).toThrow(FileFormatError)
  })

  it('removes the extension from file names', () => {
    expect(baseName('drawing.ka2')).toBe('drawing')
    expect(baseName('my.drawing.ka2')).toBe('my.drawing')
    expect(baseName('drawing')).toBe('drawing')
  })

  it('normalizes entered file names', () => {
    expect(normalizeFileName('  drawing  ')).toBe('drawing')
    expect(normalizeFileName('drawing.KA2')).toBe('drawing')
    expect(normalizeFileName('drawing.png')).toBe('drawing.png')
    expect(normalizeFileName('   ')).toBeUndefined()
    expect(normalizeFileName('.ka2')).toBeUndefined()
  })
})
