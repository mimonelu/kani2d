import { computed, ref, shallowRef } from 'vue'
import { CENTER_ANCHOR, DEFAULT_CANVAS_SIZE, HISTORY_LIMIT } from '../model/constants'
import {
  addLayer as addLayerToDoc,
  clearLayer as clearLayerInDoc,
  createDocument,
  deleteLayer as deleteLayerFromDoc,
  duplicateLayer as duplicateLayerInDoc,
  eraseTile,
  fillTiles,
  getTile,
  hasTiles,
  isInside,
  isShape,
  moveLayer as moveLayerInDoc,
  offsetTiles,
  paintTile,
  resizeDocument,
  rotateTile,
  setLayerVisible,
  trimDocument,
  type PaintResult,
} from '../model/document'
import { baseName, parseDocument, serializeDocument } from '../model/fileFormat'
import { History } from '../model/history'
import { DEFAULT_COLOR, PALETTE } from '../model/palette'
import { DEFAULT_TOOL, isTool, type Tool } from '../model/tools'
import { Shape, type Doc, type Layer, type ResizeAnchor, type Tile } from '../model/types'

interface Snapshot {
  doc: Doc
  activeLayerId: string
}

interface Stroke {
  before: Snapshot
  layer: Layer
  changed: boolean
}

/** 自動保存する状態 */
export interface PersistedState {
  version: 1
  /** 独自形式ファイルと同じ内容 */
  file: string
  /** ファイル名が無い場合は null */
  name: string | null
  dirty: boolean
  color: string
  /** 選択中の形状。省略時は四角 */
  shape?: Shape
  activeIndex: number
}

function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  return (
    state.version === 1 &&
    typeof state.file === 'string' &&
    (typeof state.name === 'string' || state.name === null) &&
    typeof state.dirty === 'boolean' &&
    typeof state.color === 'string' &&
    (state.shape === undefined || isShape(state.shape)) &&
    typeof state.activeIndex === 'number'
  )
}

export function createEditorStore() {
  const initialDoc = createDocument()
  const doc = shallowRef<Doc>(initialDoc)
  /** 最後にファイルと一致していたドキュメント。不一致なら未保存の変更がある */
  const savedDoc = shallowRef<Doc | null>(initialDoc)
  /** ストローク中のタイル変更など、ドキュメントの参照が変わらない変更も含めて増える */
  const revision = ref(0)
  /** 拡張子を除いたファイル名。無い場合は undefined */
  const docName = ref<string | undefined>(undefined)
  const activeLayerId = ref(initialDoc.layers[0]!.id)
  const selectedColor = ref(DEFAULT_COLOR)
  /** 空のマスに設置するタイルの形状 */
  const selectedShape = ref<Shape>(Shape.Square)
  /** 左クリック・左ドラッグの操作。自動保存の対象外 */
  const activeTool = ref<Tool>(DEFAULT_TOOL)
  /** 増えるたびにキャンバスの表示を初期状態に戻す */
  const viewResetToken = ref(0)
  const history = new History<Snapshot>(HISTORY_LIMIT)
  const historyVersion = ref(0)
  let stroke: Stroke | null = null

  const activeIndex = computed(() => {
    const index = doc.value.layers.findIndex((layer) => layer.id === activeLayerId.value)
    return index < 0 ? 0 : index
  })
  const activeLayer = computed(() => doc.value.layers[activeIndex.value]!)
  const isDirty = computed(() => doc.value !== savedDoc.value)
  const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo)
  const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo)
  /** 自動切り抜きできるか。ストローク中のタイル変更も反映するため revision に依存させる */
  const canTrim = computed(() => revision.value >= 0 && hasTiles(doc.value))

  function snapshot(): Snapshot {
    return { doc: doc.value, activeLayerId: activeLayerId.value }
  }

  function apply(state: Snapshot): void {
    doc.value = state.doc
    activeLayerId.value = state.activeLayerId
    revision.value++
  }

  function touchHistory(): void {
    historyVersion.value++
  }

  /** 履歴に積んでから新しいドキュメントに置き換える */
  function commit(next: Doc, nextActiveLayerId = activeLayerId.value): void {
    if (stroke) return
    history.push(snapshot())
    touchHistory()
    apply({ doc: next, activeLayerId: nextActiveLayerId })
  }

  function reset(next: Doc, name: string | undefined, saved: boolean): void {
    stroke = null
    history.clear()
    touchHistory()
    doc.value = next
    savedDoc.value = saved ? next : null
    docName.value = name || undefined
    activeLayerId.value = next.layers[0]!.id
    revision.value++
    viewResetToken.value++
  }

  function newDocument(name?: string, width = DEFAULT_CANVAS_SIZE, height = DEFAULT_CANVAS_SIZE): void {
    reset(createDocument(width, height), name, true)
  }

  /** 失敗時は FileFormatError を投げ、現在の内容は変更しない */
  function loadFile(text: string, fileName: string): void {
    const parsed = parseDocument(text)
    reset(parsed, baseName(fileName), true)
  }

  function serialize(): string {
    return serializeDocument(doc.value)
  }

  /** 保存したドキュメントを記録する。保存処理中に編集された場合に備え、保存した時点のドキュメントを渡せる */
  function markSaved(saved: Doc = doc.value): void {
    savedDoc.value = saved
  }

  function setDocName(name: string | undefined): void {
    docName.value = name || undefined
  }

  function setActiveLayer(id: string): void {
    if (doc.value.layers.some((layer) => layer.id === id)) activeLayerId.value = id
  }

  function indexOf(id: string): number {
    return doc.value.layers.findIndex((layer) => layer.id === id)
  }

  function addLayer(): void {
    const result = addLayerToDoc(doc.value, activeIndex.value)
    commit(result.doc, result.layer.id)
  }

  function duplicateLayer(id: string): void {
    const index = indexOf(id)
    if (index < 0) return
    const result = duplicateLayerInDoc(doc.value, index)
    commit(result.doc, result.layer.id)
  }

  function deleteLayer(id: string): void {
    const index = indexOf(id)
    if (index <= 0) return
    const next = deleteLayerFromDoc(doc.value, index)
    const nextActive = id === activeLayerId.value ? next.layers[index - 1]!.id : activeLayerId.value
    commit(next, nextActive)
  }

  function toggleLayerVisibility(id: string): void {
    const index = indexOf(id)
    if (index < 0) return
    commit(setLayerVisible(doc.value, index, !doc.value.layers[index]!.visible))
  }

  /** レイヤーのタイルをすべて取り除く */
  function clearLayer(id: string): void {
    const index = indexOf(id)
    if (index < 0) return
    const next = clearLayerInDoc(doc.value, index)
    if (next !== doc.value) commit(next)
  }

  function moveLayer(from: number, to: number): void {
    if (from === to) return
    commit(moveLayerInDoc(doc.value, from, to))
  }

  function resize(width: number, height: number, anchor: ResizeAnchor = CENTER_ANCHOR): void {
    if (width === doc.value.width && height === doc.value.height) return
    commit(resizeDocument(doc.value, width, height, anchor))
  }

  /** 全レイヤーのタイルを囲む最小の矩形でキャンバスを切り抜く */
  function trim(): void {
    const next = trimDocument(doc.value)
    if (next !== doc.value) commit(next)
  }

  function selectColor(color: string): void {
    if (PALETTE.includes(color)) selectedColor.value = color
  }

  function selectShape(shape: Shape): void {
    if (isShape(shape)) selectedShape.value = shape
  }

  function selectTool(tool: Tool): void {
    if (isTool(tool)) activeTool.value = tool
  }

  /**
   * スポイト。マスにタイルを持つ最前面の表示中のレイヤーから、タイルの形状と色を選択する
   * - パレットに無い色は選択しない
   * - 拾うタイルが無い場合は false を返す
   */
  function pickAt(x: number, y: number): boolean {
    const { layers } = doc.value
    for (let index = layers.length - 1; index >= 0; index--) {
      const layer = layers[index]!
      if (!layer.visible) continue
      const tile = getTile(layer.tiles, x, y)
      if (!tile) continue
      selectShape(tile.shape)
      selectColor(tile.color)
      return true
    }
    return false
  }

  /**
   * 塗りつぶし。1 回のクリックを 1 件の履歴とする
   * - 非表示のレイヤーは編集結果が見えないため編集できない
   * - 変更が無い場合は false を返す
   */
  function fillAt(x: number, y: number): boolean {
    if (stroke || !activeLayer.value.visible || !isInside(doc.value, x, y)) return false
    // レイヤーの複製を避けるため、変更が無いことが明らかな場合は先に返す
    if (tileAt(x, y)?.color === selectedColor.value) return false
    const index = activeIndex.value
    const source = doc.value.layers[index]!
    const tiles = new Map(source.tiles)
    if (fillTiles(tiles, doc.value, x, y, selectedColor.value, selectedShape.value) === 0) return false
    const layers = [...doc.value.layers]
    layers[index] = { ...source, tiles }
    commit({ ...doc.value, layers })
    return true
  }

  function tileAt(x: number, y: number): Tile | undefined {
    return getTile(activeLayer.value.tiles, x, y)
  }

  /**
   * ストローク開始時にアクティブなレイヤーを複製し、以降はその複製を直接編集する
   * - 非表示のレイヤーは編集結果が見えないため編集できない
   */
  function beginStroke(): boolean {
    if (stroke || !activeLayer.value.visible) return false
    const index = activeIndex.value
    const source = doc.value.layers[index]!
    const layer: Layer = { ...source, tiles: new Map(source.tiles) }
    const layers = [...doc.value.layers]
    layers[index] = layer
    stroke = { before: snapshot(), layer, changed: false }
    doc.value = { ...doc.value, layers }
    return true
  }

  function markStrokeChanged(): void {
    if (!stroke) return
    stroke.changed = true
    revision.value++
  }

  function paintAt(x: number, y: number): PaintResult {
    if (!stroke || !isInside(doc.value, x, y)) return 'unchanged'
    const result = paintTile(stroke.layer.tiles, x, y, selectedColor.value, selectedShape.value)
    if (result !== 'unchanged') markStrokeChanged()
    return result
  }

  function rotateAt(x: number, y: number): boolean {
    if (!stroke || !isInside(doc.value, x, y)) return false
    const changed = rotateTile(stroke.layer.tiles, x, y)
    if (changed) markStrokeChanged()
    return changed
  }

  function eraseAt(x: number, y: number): boolean {
    if (!stroke || !isInside(doc.value, x, y)) return false
    const changed = eraseTile(stroke.layer.tiles, x, y)
    if (changed) markStrokeChanged()
    return changed
  }

  /** ストローク中のレイヤーのタイルをまとめて移動する。キャンバス範囲外に出たタイルは削除する */
  function moveTiles(dx: number, dy: number): boolean {
    if (!stroke || (dx === 0 && dy === 0)) return false
    const { tiles } = stroke.layer
    if (tiles.size === 0) return false
    const moved = offsetTiles(tiles, dx, dy, doc.value)
    tiles.clear()
    for (const [key, tile] of moved) tiles.set(key, tile)
    markStrokeChanged()
    return true
  }

  function endStroke(): void {
    if (!stroke) return
    const { before, changed } = stroke
    stroke = null
    if (changed) {
      history.push(before)
      touchHistory()
    } else {
      // 変更が無ければ参照を元に戻し、未保存扱いにしない
      doc.value = before.doc
    }
  }

  function isStroking(): boolean {
    return stroke !== null
  }

  function undo(): void {
    if (stroke) return
    const previous = history.undo(snapshot())
    if (!previous) return
    touchHistory()
    apply(previous)
  }

  function redo(): void {
    if (stroke) return
    const next = history.redo(snapshot())
    if (!next) return
    touchHistory()
    apply(next)
  }

  function exportState(): PersistedState {
    return {
      version: 1,
      file: serialize(),
      name: docName.value ?? null,
      dirty: isDirty.value,
      color: selectedColor.value,
      shape: selectedShape.value,
      activeIndex: activeIndex.value,
    }
  }

  /** 不正な状態の場合は例外を投げ、現在の内容は変更しない */
  function restoreState(value: unknown): void {
    if (!isPersistedState(value)) throw new Error('Invalid saved state.')
    const restored = parseDocument(value.file)
    reset(restored, value.name ?? undefined, !value.dirty)
    selectColor(value.color)
    selectedShape.value = value.shape ?? Shape.Square
    const index = Math.min(Math.max(0, Math.trunc(value.activeIndex)), restored.layers.length - 1)
    activeLayerId.value = restored.layers[index]!.id
  }

  return {
    doc,
    savedDoc,
    revision,
    docName,
    activeLayerId,
    activeIndex,
    activeLayer,
    selectedColor,
    selectedShape,
    activeTool,
    viewResetToken,
    isDirty,
    canUndo,
    canRedo,
    canTrim,
    newDocument,
    loadFile,
    serialize,
    markSaved,
    setDocName,
    setActiveLayer,
    addLayer,
    duplicateLayer,
    deleteLayer,
    toggleLayerVisibility,
    clearLayer,
    moveLayer,
    resize,
    trim,
    selectColor,
    selectShape,
    selectTool,
    pickAt,
    fillAt,
    tileAt,
    beginStroke,
    paintAt,
    rotateAt,
    eraseAt,
    moveTiles,
    endStroke,
    isStroking,
    undo,
    redo,
    exportState,
    restoreState,
  }
}

export type EditorStore = ReturnType<typeof createEditorStore>

export const editor = createEditorStore()
