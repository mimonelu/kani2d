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
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.TopLeft)
    store.undo()
    expect(store.tileAt(0, 0)?.shape).toBe(Shape.Square)
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
    const state = source.exportState()

    const store = createEditorStore()
    store.restoreState(state)
    expect(store.doc.value.layers).toHaveLength(2)
    expect(store.activeIndex.value).toBe(1)
    expect(store.selectedColor.value).toBe('#FF0000')
    expect(store.isDirty.value).toBe(true)
    expect(store.tileAt(1, 1)?.color).toBe('#FF0000')
    expect(store.docName.value).toBeUndefined()
    expect(() => store.restoreState({ version: 1 })).toThrow()
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
