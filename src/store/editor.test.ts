import { describe, expect, it } from 'vitest'
import { Shape } from '../model/types'
import { createEditorStore } from './editor'

describe('editor store', () => {
  it('records one history entry per stroke and supports undo/redo', () => {
    const store = createEditorStore()
    expect(store.isDirty.value).toBe(false)
    store.beginStroke()
    store.paintAt(0, 0)
    store.paintAt(1, 0)
    store.endStroke()
    expect(store.activeLayer.value.tiles.size).toBe(2)
    expect(store.isDirty.value).toBe(true)
    expect(store.canUndo.value).toBe(true)

    store.undo()
    expect(store.activeLayer.value.tiles.size).toBe(0)
    expect(store.isDirty.value).toBe(false)
    expect(store.canRedo.value).toBe(true)

    store.redo()
    expect(store.activeLayer.value.tiles.size).toBe(2)
  })

  it('does not record strokes without changes', () => {
    const store = createEditorStore()
    const before = store.doc.value
    store.beginStroke()
    store.paintAt(-1, 0)
    store.endStroke()
    expect(store.doc.value).toBe(before)
    expect(store.canUndo.value).toBe(false)
  })

  it('keeps previous history entries unchanged while editing', () => {
    const store = createEditorStore()
    store.beginStroke()
    store.paintAt(0, 0)
    store.endStroke()
    store.beginStroke()
    store.rotateAt(0, 0)
    store.endStroke()
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.BottomRight)
    store.undo()
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.Square)
  })

  it('places tiles in the selected shape on empty cells', () => {
    const store = createEditorStore()
    expect(store.selectedShape.value).toBe(Shape.Square)
    store.selectShape(Shape.TopRight)
    store.selectShape(9 as Shape)
    expect(store.selectedShape.value).toBe(Shape.TopRight)

    store.beginStroke()
    store.paintAt(0, 0)
    store.paintAt(1, 0)
    store.endStroke()
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.TopRight)
    expect(store.tileAt(1, 0)?.shape).toBe(Shape.TopRight)

    // ローテーションと色の置き換えでは選択中の形状を変えない
    store.beginStroke()
    store.rotateAt(0, 0)
    store.endStroke()
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.Square)
    store.selectShape(Shape.BottomLeft)
    store.selectColor('#FF0000')
    store.beginStroke()
    store.paintAt(1, 0)
    store.endStroke()
    expect(store.tileAt(1, 0)).toMatchObject({ color: '#FF0000', shape: Shape.TopRight })
    expect(store.selectedShape.value).toBe(Shape.BottomLeft)

    // 新規作成では選択中の形状を維持する
    store.newDocument()
    expect(store.selectedShape.value).toBe(Shape.BottomLeft)
  })

  it('picks the shape and color of the frontmost visible tile', () => {
    const store = createEditorStore()
    store.selectColor('#FF0000')
    store.selectShape(Shape.TopLeft)
    store.beginStroke()
    store.paintAt(0, 0)
    store.paintAt(1, 0)
    store.endStroke()
    store.addLayer()
    store.selectColor('#0000FF')
    store.selectShape(Shape.BottomLeft)
    store.beginStroke()
    store.paintAt(0, 0)
    store.endStroke()
    const front = store.activeLayerId.value

    store.selectColor('#FFFFFF')
    store.selectShape(Shape.Square)
    // 背面のレイヤーがアクティブでも、最前面のタイルを拾う
    store.setActiveLayer(store.doc.value.layers[0]!.id)
    expect(store.pickAt(0, 0)).toBe(true)
    expect(store.selectedColor.value).toBe('#0000FF')
    expect(store.selectedShape.value).toBe(Shape.BottomLeft)
    expect(store.pickAt(1, 0)).toBe(true)
    expect(store.selectedColor.value).toBe('#FF0000')
    expect(store.selectedShape.value).toBe(Shape.TopLeft)

    // 非表示のレイヤーは対象外
    store.toggleLayerVisibility(front)
    expect(store.pickAt(0, 0)).toBe(true)
    expect(store.selectedColor.value).toBe('#FF0000')

    // 空のマスでは何も変えず、履歴にも積まない
    store.selectShape(Shape.Square)
    const before = store.doc.value
    expect(store.pickAt(5, 5)).toBe(false)
    expect(store.selectedShape.value).toBe(Shape.Square)
    expect(store.doc.value).toBe(before)
  })

  it('fills the active layer as one history entry', () => {
    const store = createEditorStore()
    store.newDocument(undefined, 3, 2)
    store.selectColor('#FF0000')
    store.beginStroke()
    store.paintAt(1, 0)
    store.paintAt(1, 1)
    store.endStroke()
    // 他のレイヤーのタイルは境界にならない
    store.addLayer()
    store.beginStroke()
    store.paintAt(2, 0)
    store.endStroke()
    store.setActiveLayer(store.doc.value.layers[0]!.id)

    store.selectColor('#0000FF')
    store.selectShape(Shape.TopLeft)
    expect(store.fillAt(2, 1)).toBe(true)
    const background = () => store.activeLayer.value.tiles
    expect(background().size).toBe(4)
    expect(store.tileAt(2, 0)).toEqual({ x: 2, y: 0, color: '#0000FF', shape: Shape.TopLeft })
    expect(store.tileAt(0, 0)).toBeUndefined()
    expect(store.doc.value.layers[1]!.tiles.size).toBe(1)

    // 同じ色でつながるタイルを置き換える
    store.selectColor('#00FF00')
    expect(store.fillAt(1, 1)).toBe(true)
    expect(store.tileAt(1, 0)?.color).toBe('#00FF00')
    expect(store.tileAt(2, 0)?.color).toBe('#0000FF')

    store.undo()
    expect(store.tileAt(1, 0)?.color).toBe('#FF0000')
    store.undo()
    expect(background().size).toBe(2)

    // 変更が無い場合や範囲外は履歴に積まない
    const before = store.doc.value
    store.selectColor('#FF0000')
    expect(store.fillAt(1, 0)).toBe(false)
    expect(store.fillAt(3, 0)).toBe(false)
    expect(store.doc.value).toBe(before)

    // 非表示のレイヤーは編集できない
    store.toggleLayerVisibility(store.activeLayerId.value)
    expect(store.fillAt(0, 0)).toBe(false)
    expect(store.tileAt(0, 0)).toBeUndefined()
  })

  it('picks only the shape when the color is not in the palette', () => {
    const store = createEditorStore()
    store.loadFile(
      JSON.stringify({
        format: 'kani2d',
        version: 2,
        width: 2,
        height: 2,
        layers: [{ name: 'Background', visible: true, tiles: [[0, 0, '#123456', 3]] }],
      }),
      'odd.ka2',
    )
    expect(store.pickAt(0, 0)).toBe(true)
    expect(store.selectedShape.value).toBe(Shape.BottomRight)
    expect(store.selectedColor.value).toBe('#FFFFFF')
  })

  it('selects tools and keeps them out of the persisted state', () => {
    const store = createEditorStore()
    expect(store.activeTool.value).toBe('draw')
    store.selectTool('pan')
    store.selectTool('bucket' as never)
    expect(store.activeTool.value).toBe('pan')
    expect(store.exportState()).not.toHaveProperty('tool')
    store.newDocument()
    expect(store.activeTool.value).toBe('pan')
  })

  it('edits only the active layer', () => {
    const store = createEditorStore()
    store.addLayer()
    expect(store.activeIndex.value).toBe(1)
    store.beginStroke()
    store.paintAt(0, 0)
    store.endStroke()
    expect(store.doc.value.layers[0]!.tiles.size).toBe(0)
    expect(store.doc.value.layers[1]!.tiles.size).toBe(1)
  })

  it('activates the layer below when deleting the active layer', () => {
    const store = createEditorStore()
    store.addLayer()
    store.addLayer()
    const [background, first, second] = store.doc.value.layers
    expect(store.activeLayerId.value).toBe(second!.id)
    store.deleteLayer(second!.id)
    expect(store.activeLayerId.value).toBe(first!.id)
    store.deleteLayer(background!.id)
    expect(store.doc.value.layers).toHaveLength(2)
  })

  it('tracks unsaved changes against the last saved document', () => {
    const store = createEditorStore()
    store.addLayer()
    expect(store.isDirty.value).toBe(true)
    store.markSaved()
    expect(store.isDirty.value).toBe(false)

    // 保存処理中に編集された場合は未保存の変更として残る
    const saving = store.doc.value
    store.addLayer()
    store.markSaved(saving)
    expect(store.isDirty.value).toBe(true)
  })

  it('creates a new document with the given name and size', () => {
    const store = createEditorStore()
    expect(store.docName.value).toBeUndefined()
    store.addLayer()
    store.newDocument('picture', 10, 6)
    expect(store.docName.value).toBe('picture')
    expect(store.doc.value).toMatchObject({ width: 10, height: 6 })
    expect(store.doc.value.layers).toHaveLength(1)
    expect(store.isDirty.value).toBe(false)
    expect(store.canUndo.value).toBe(false)
    store.newDocument()
    expect(store.docName.value).toBeUndefined()
    expect(store.doc.value).toMatchObject({ width: 32, height: 32 })
    store.setDocName('saved')
    expect(store.docName.value).toBe('saved')
  })

  it('toggles layer visibility with undo and does not edit hidden layers', () => {
    const store = createEditorStore()
    const id = store.activeLayerId.value
    store.toggleLayerVisibility(id)
    expect(store.activeLayer.value.visible).toBe(false)
    expect(store.isDirty.value).toBe(true)
    expect(store.beginStroke()).toBe(false)
    expect(store.paintAt(0, 0)).toBe('unchanged')
    store.endStroke()
    expect(store.activeLayer.value.tiles.size).toBe(0)

    store.undo()
    expect(store.activeLayer.value.visible).toBe(true)
    expect(store.beginStroke()).toBe(true)
    expect(store.paintAt(0, 0)).toBe('placed')
    store.endStroke()
  })

  it('clears a layer with undo', () => {
    const store = createEditorStore()
    const id = store.activeLayerId.value
    store.beginStroke()
    store.paintAt(0, 0)
    store.paintAt(1, 0)
    store.endStroke()
    store.addLayer()
    store.clearLayer(id)
    expect(store.doc.value.layers[0]!.tiles.size).toBe(0)
    // アクティブなレイヤーは変えない
    expect(store.activeIndex.value).toBe(1)

    // タイルが無い場合は履歴に積まない
    const before = store.doc.value
    store.clearLayer(id)
    expect(store.doc.value).toBe(before)

    store.undo()
    expect(store.doc.value.layers[0]!.tiles.size).toBe(2)
  })

  it('resizes around the center with undo', () => {
    const store = createEditorStore()
    store.resize(4, 4)
    store.beginStroke()
    store.paintAt(1, 1)
    store.endStroke()
    store.resize(6, 6)
    expect(store.tileAt(2, 2)).toBeDefined()
    store.undo()
    expect(store.doc.value.width).toBe(4)
    expect(store.tileAt(1, 1)).toBeDefined()

    store.resize(6, 6, { x: 1, y: 1 })
    expect(store.tileAt(3, 3)).toBeDefined()
    store.undo()
    expect(store.tileAt(1, 1)).toBeDefined()
  })

  it('moves all tiles of the active layer as one history entry', () => {
    const store = createEditorStore()
    store.resize(4, 4)
    store.beginStroke()
    store.paintAt(0, 0)
    store.paintAt(3, 3)
    store.endStroke()
    store.addLayer()
    store.beginStroke()
    store.paintAt(1, 1)
    store.endStroke()

    store.beginStroke()
    expect(store.moveTiles(1, 0)).toBe(true)
    store.endStroke()
    expect(store.tileAt(2, 1)).toBeDefined()
    expect(store.tileAt(1, 1)).toBeUndefined()
    expect(store.doc.value.layers[0]!.tiles.size).toBe(2)

    // キャンバス範囲外に出たタイルは削除する
    store.setActiveLayer(store.doc.value.layers[0]!.id)
    store.beginStroke()
    store.moveTiles(-1, -1)
    store.endStroke()
    expect([...store.activeLayer.value.tiles.keys()]).toEqual(['2,2'])
    store.undo()
    expect(store.tileAt(0, 0)).toBeDefined()
    expect(store.tileAt(3, 3)).toBeDefined()
  })

  it('does not record moves without changes', () => {
    const store = createEditorStore()
    store.beginStroke()
    expect(store.moveTiles(2, 2)).toBe(false)
    store.endStroke()
    store.beginStroke()
    store.paintAt(0, 0)
    store.endStroke()
    store.beginStroke()
    expect(store.moveTiles(0, 0)).toBe(false)
    store.endStroke()
    expect(store.moveTiles(1, 1)).toBe(false)
    store.undo()
    expect(store.canUndo.value).toBe(false)
  })

  it('trims the canvas to the tiles of all layers with undo', () => {
    const store = createEditorStore()
    expect(store.canTrim.value).toBe(false)
    store.trim()
    expect(store.canUndo.value).toBe(false)

    store.resize(8, 8)
    store.beginStroke()
    store.paintAt(2, 3)
    store.endStroke()
    expect(store.canTrim.value).toBe(true)
    store.addLayer()
    store.beginStroke()
    store.paintAt(5, 4)
    store.endStroke()
    // 非表示のレイヤーのタイルも含める
    store.toggleLayerVisibility(store.activeLayerId.value)

    store.trim()
    expect(store.doc.value).toMatchObject({ width: 4, height: 2 })
    expect(store.doc.value.layers[0]!.tiles.has('0,0')).toBe(true)
    expect(store.doc.value.layers[1]!.tiles.has('3,1')).toBe(true)
    const trimmed = store.doc.value
    store.trim()
    expect(store.doc.value).toBe(trimmed)

    store.undo()
    expect(store.doc.value).toMatchObject({ width: 8, height: 8 })
  })

  it('loads files and clears history', () => {
    const source = createEditorStore()
    source.resize(4, 3)
    source.beginStroke()
    source.paintAt(3, 2)
    source.endStroke()

    const store = createEditorStore()
    store.addLayer()
    store.loadFile(source.serialize(), 'picture.ka2')
    expect(store.docName.value).toBe('picture')
    expect(store.doc.value.width).toBe(4)
    expect(store.isDirty.value).toBe(false)
    expect(store.canUndo.value).toBe(false)
    expect(() => store.loadFile('{}', 'broken.ka2')).toThrow()
    expect(store.docName.value).toBe('picture')
  })

  it('restores the persisted state', () => {
    const source = createEditorStore()
    source.addLayer()
    source.selectColor('#FF0000')
    source.beginStroke()
    source.paintAt(1, 1)
    source.endStroke()
    source.selectShape(Shape.TopLeft)
    const state = source.exportState()

    const store = createEditorStore()
    store.restoreState(state)
    expect(store.doc.value.layers).toHaveLength(2)
    expect(store.activeIndex.value).toBe(1)
    expect(store.selectedColor.value).toBe('#FF0000')
    expect(store.isDirty.value).toBe(true)
    expect(store.tileAt(1, 1)?.color).toBe('#FF0000')
    expect(store.docName.value).toBeUndefined()
    expect(store.selectedShape.value).toBe(Shape.TopLeft)
    expect(() => store.restoreState({ version: 1 })).toThrow()

    // 選択中の形状を持たない状態も復元できる
    const { shape: _shape, ...withoutShape } = state
    store.restoreState(withoutShape)
    expect(store.selectedShape.value).toBe(Shape.Square)
    expect(() => store.restoreState({ ...state, shape: 5 })).toThrow()
  })

  it('restores the file name of the persisted state', () => {
    const source = createEditorStore()
    source.newDocument('picture')
    const store = createEditorStore()
    store.restoreState(source.exportState())
    expect(store.docName.value).toBe('picture')
    expect(store.isDirty.value).toBe(false)
  })
})
