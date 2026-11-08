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
    store.newDocument()
    expect(store.doc.value.layers).toHaveLength(1)
    expect(store.canUndo.value).toBe(false)
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
    expect(() => store.restoreState({ version: 1 })).toThrow()
  })
})
