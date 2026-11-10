<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEFAULT_TILE_SIZE, TILE_SIZES } from '../model/constants'
import { isInside, lineCells } from '../model/document'
import { canPlaceSprite, rectFromCells, sameRect, spriteAt } from '../model/sprites'
import type { Tool } from '../model/tools'
import type { Cell, Rect } from '../model/types'
import { PAINT_BUCKET_CURSOR, PIPETTE_CURSOR } from '../render/cursors'
import { CANVAS_COLORS, appendShapePath, drawLayerTiles, fillChecker, type CellRange } from '../render/drawTiles'
import { editor } from '../store/editor'
import { isEditableTarget } from '../utils/dom'
import { IS_MAC } from '../utils/platform'

const props = defineProps<{
  /** モーダル表示中など、キャンバスへのキーボード操作を受け付けない状態 */
  locked: boolean
}>()

const emit = defineEmits<{
  /** スプライトの名前ラベルが押された */
  editSprite: [id: string]
}>()

const {
  doc,
  revision,
  selectedColor,
  selectedShape,
  activeTool,
  viewResetToken,
  activeLayer,
  activeLayerId,
  selectedSpriteId,
  selectedSprite,
} = editor

/** 市松模様の 1 マスの大きさ（CSS px） */
const CHECKER_SIZE = 8
/** 空のマスに設置されるタイルのプレビューの不透明度 */
const PREVIEW_ALPHA = 0.5
/** 移動中にキャンバス範囲外に出たタイルの不透明度 */
const OUTSIDE_ALPHA = 0.35
/** 押下中に左ドラッグを Move に切り替える修飾キー（`KeyboardEvent.key`） */
const MOVE_MODIFIER_KEY = IS_MAC ? 'Meta' : 'Control'
/** トラックパッドなどの連続的な入力で 1 段階とみなす移動量 */
const WHEEL_THRESHOLD = 50
/** ピンチ操作（ctrlKey 付きのホイール）で 1 段階とみなす移動量 */
const PINCH_THRESHOLD = 8
/** この時間（ms）以上間隔が空いたホイール操作は、新たな操作の開始とみなす */
const WHEEL_GESTURE_GAP = 150
/** macOS の Chrome / Safari がマウスホイール 1 目盛りにつき返す移動量の単位 */
const MAC_WHEEL_DELTA = 4.000244140625
/** スプライトの辺をつかめる範囲（CSS px） */
const SPRITE_EDGE_HIT = 6
/** スプライトのリサイズ用ハンドルの大きさ（CSS px） */
const SPRITE_HANDLE_SIZE = 7

const container = ref<HTMLDivElement>()
const mainCanvas = ref<HTMLCanvasElement>()
const overlayCanvas = ref<HTMLCanvasElement>()

const viewWidth = ref(0)
const viewHeight = ref(0)
const tileSize = ref(DEFAULT_TILE_SIZE)
/** キャンバス左上の表示位置（CSS px） */
const originX = ref(0)
const originY = ref(0)
const hover = ref<Cell | null>(null)
const spaceHeld = ref(false)
const altHeld = ref(false)
const moveKeyHeld = ref(false)
/** マウス位置（CSS px）。スプライトの辺の上かの判定に使う */
const hoverPoint = ref<{ x: number; y: number } | null>(null)
/** Move の操作中の移動量（マス）。操作中でなければ null */
const moveOffset = ref<Cell | null>(null)

/** スプライトのリサイズでつかんだ辺 */
interface SpriteEdges {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

/** 操作中のスプライトの範囲。id が null の場合は作成中。valid が false の場合は離しても確定しない */
interface SpriteDraft {
  id: string | null
  rect: Rect
  valid: boolean
}

type Gesture =
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'paint'; pointerId: number; last: Cell; pendingRotate: Cell | null }
  | { kind: 'erase'; pointerId: number; last: Cell }
  | { kind: 'move'; pointerId: number; start: Cell }
  | { kind: 'sprite-create'; pointerId: number; start: Cell }
  | { kind: 'sprite-move'; pointerId: number; id: string; start: Cell; origin: Rect }
  | { kind: 'sprite-resize'; pointerId: number; id: string; origin: Rect; edges: SpriteEdges }

const gesture = ref<Gesture | null>(null)
const spriteDraft = ref<SpriteDraft | null>(null)

/** 非表示のレイヤーは編集できない */
const editable = computed(() => activeLayer.value.visible)

/**
 * 左クリックの操作。以下のキーの押下中は一時的に切り替える
 * - Space キー: Pan
 * - Ctrl（macOS は ⌘）キー: Move
 * - Alt キー: Pick
 */
const leftTool = computed<Tool>(() => {
  if (spaceHeld.value) return 'pan'
  if (moveKeyHeld.value) return 'move'
  if (altHeld.value) return 'pick'
  return activeTool.value
})

/** マウス位置に対する操作。操作中はその操作とする */
const hoverTool = computed<Tool>(() => {
  switch (gesture.value?.kind) {
    case 'pan':
      return 'pan'
    case 'paint':
      return 'draw'
    case 'erase':
      return 'erase'
    case 'move':
      return 'move'
    case 'sprite-create':
    case 'sprite-move':
    case 'sprite-resize':
      return 'sprite'
    default:
      return leftTool.value
  }
})

/** Sprite ツールの選択中は、名前ラベルやハンドルなどの全 UI を表示する。それ以外のツールでは矩形のみ表示する */
const spriteMode = computed(() => activeTool.value === 'sprite')

function resizeCursor(edges: SpriteEdges): string {
  const horizontal = edges.left || edges.right
  const vertical = edges.top || edges.bottom
  if (horizontal && vertical) return (edges.left && edges.top) || (edges.right && edges.bottom) ? 'nwse-resize' : 'nesw-resize'
  return horizontal ? 'ew-resize' : 'ns-resize'
}

function spriteCursor(): string {
  const current = gesture.value
  if (current?.kind === 'sprite-resize') return resizeCursor(current.edges)
  if (current?.kind === 'sprite-move') return 'move'
  if (current) return 'crosshair'
  const edges = hoverPoint.value ? spriteEdgesAt(hoverPoint.value) : null
  if (edges) return resizeCursor(edges)
  if (hover.value && spriteAt(doc.value, hover.value.x, hover.value.y)) return 'move'
  return 'crosshair'
}

const cursor = computed(() => {
  switch (hoverTool.value) {
    case 'sprite':
      return spriteCursor()
    case 'pan':
      return gesture.value ? 'grabbing' : 'grab'
    case 'pick':
      return PIPETTE_CURSOR
    case 'fill':
      return editable.value ? PAINT_BUCKET_CURSOR : 'not-allowed'
    case 'move':
      return editable.value ? 'move' : 'not-allowed'
    default:
      return editable.value ? 'crosshair' : 'not-allowed'
  }
})

const hoverInside = computed(() => hover.value !== null && isInside(doc.value, hover.value.x, hover.value.y))

// ---- 描画 ----

let frame = 0
let mainDirty = true
let overlayDirty = true

function requestRender(main: boolean) {
  if (main) mainDirty = true
  overlayDirty = true
  if (!frame) frame = requestAnimationFrame(render)
}

function render() {
  frame = 0
  if (mainDirty) drawMain()
  if (overlayDirty) drawOverlay()
  mainDirty = false
  overlayDirty = false
}

function prepareCanvas(canvas: HTMLCanvasElement | undefined): { ctx: CanvasRenderingContext2D; dpr: number } | null {
  if (!canvas) return null
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(viewWidth.value * dpr))
  const height = Math.max(1, Math.round(viewHeight.value * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return { ctx, dpr }
}

function shiftRange(range: CellRange, dx: number, dy: number): CellRange {
  return { x0: range.x0 + dx, y0: range.y0 + dy, x1: range.x1 + dx, y1: range.y1 + dy }
}

/** マス座標をデバイスピクセル座標に変換する関数。隣接するマスが同じ整数座標を共有するよう丸める */
function deviceMapper(dpr: number) {
  const size = tileSize.value * dpr
  const ox = Math.round(originX.value * dpr)
  const oy = Math.round(originY.value * dpr)
  return {
    size,
    ox,
    oy,
    x: (cx: number) => ox + Math.round(cx * size),
    y: (cy: number) => oy + Math.round(cy * size),
  }
}

function drawMain() {
  const prepared = prepareCanvas(mainCanvas.value)
  if (!prepared) return
  const { ctx, dpr } = prepared
  const { width: canvasWidth, height: canvasHeight } = ctx.canvas
  ctx.fillStyle = CANVAS_COLORS.outside
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const current = doc.value
  const map = deviceMapper(dpr)
  // Move の操作中は、アクティブなレイヤーを移動後の位置に描画する
  const offset = moveOffset.value
  const moving = offset && (offset.x !== 0 || offset.y !== 0) ? offset : null
  const movingLayer = moving ? activeLayer.value : null
  const movedX = (cx: number) => map.x(cx + (moving?.x ?? 0))
  const movedY = (cy: number) => map.y(cy + (moving?.y ?? 0))
  const left = Math.max(0, map.x(0))
  const top = Math.max(0, map.y(0))
  const right = Math.min(canvasWidth, map.x(current.width))
  const bottom = Math.min(canvasHeight, map.y(current.height))
  const canvasVisible = right > left && bottom > top

  if (canvasVisible) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(left, top, right - left, bottom - top)
    ctx.clip()

    fillChecker(ctx, CHECKER_SIZE * dpr, map.ox, map.oy, left, top, right - left, bottom - top)

    // 表示範囲内のマスのみ描画する
    const range = {
      x0: Math.max(0, Math.floor((left - map.ox) / map.size) - 1),
      y0: Math.max(0, Math.floor((top - map.oy) / map.size) - 1),
      x1: Math.min(current.width - 1, Math.ceil((right - map.ox) / map.size) + 1),
      y1: Math.min(current.height - 1, Math.ceil((bottom - map.oy) / map.size) + 1),
    }
    const movedRange = moving ? shiftRange(range, -moving.x, -moving.y) : range
    for (const layer of current.layers) {
      if (!layer.visible) continue
      if (layer === movingLayer) {
        drawLayerTiles(ctx, layer, movedX, movedY, movedRange)
      } else {
        drawLayerTiles(ctx, layer, map.x, map.y, range)
      }
    }

    // ガイドライン。キャンバスの左上を起点に、間隔ごとのマスの境界に引く。キャンバスの端には引かない
    const line = Math.max(1, Math.round(dpr))
    const lineHalf = Math.floor(line / 2)
    const { width: spacingX, height: spacingY } = current.guideSpacing
    const guideLines = new Path2D()
    const lastX = Math.min(range.x1 + 1, current.width - 1)
    for (let gx = Math.ceil(Math.max(1, range.x0) / spacingX) * spacingX; gx <= lastX; gx += spacingX) {
      guideLines.rect(map.x(gx) - lineHalf, top, line, bottom - top)
    }
    const lastY = Math.min(range.y1 + 1, current.height - 1)
    for (let gy = Math.ceil(Math.max(1, range.y0) / spacingY) * spacingY; gy <= lastY; gy += spacingY) {
      guideLines.rect(left, map.y(gy) - lineHalf, right - left, line)
    }
    ctx.fillStyle = CANVAS_COLORS.guideLine
    ctx.fill(guideLines)

    // ガイドポイント（マス目の交点）
    const dot = Math.max(1, Math.round(dpr * Math.min(2, Math.max(1, tileSize.value / 16))))
    const half = Math.floor(dot / 2)
    const guides = new Path2D()
    for (let gy = range.y0; gy <= range.y1 + 1; gy++) {
      const py = map.y(gy) - half
      for (let gx = range.x0; gx <= range.x1 + 1; gx++) {
        guides.rect(map.x(gx) - half, py, dot, dot)
      }
    }
    ctx.globalAlpha = tileSize.value < 8 ? 0.5 : 1
    ctx.fillStyle = CANVAS_COLORS.guide
    ctx.fill(guides)
    ctx.globalAlpha = 1

    ctx.restore()
  }

  // 移動中にキャンバス範囲外に出た部分は、離した時点で削除されることが分かるよう半透明で描画する
  if (moving && movingLayer?.visible) {
    ctx.save()
    const outside = new Path2D()
    outside.rect(0, 0, canvasWidth, canvasHeight)
    if (canvasVisible) outside.rect(left, top, right - left, bottom - top)
    ctx.clip(outside, 'evenodd')
    ctx.globalAlpha = OUTSIDE_ALPHA
    const viewRange = {
      x0: Math.floor(-map.ox / map.size) - 1,
      y0: Math.floor(-map.oy / map.size) - 1,
      x1: Math.ceil((canvasWidth - map.ox) / map.size) + 1,
      y1: Math.ceil((canvasHeight - map.oy) / map.size) + 1,
    }
    drawLayerTiles(ctx, movingLayer, movedX, movedY, shiftRange(viewRange, -moving.x, -moving.y))
    ctx.restore()
  }
}

function drawOverlay() {
  const prepared = prepareCanvas(overlayCanvas.value)
  if (!prepared) return
  const { ctx, dpr } = prepared
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  const current = doc.value
  const map = deviceMapper(dpr)
  const line = Math.max(1, Math.round(dpr))

  // キャンバスの範囲
  ctx.strokeStyle = CANVAS_COLORS.border
  ctx.lineWidth = line
  ctx.strokeRect(
    map.x(0) - line / 2,
    map.y(0) - line / 2,
    map.x(current.width) - map.x(0) + line,
    map.y(current.height) - map.y(0) + line,
  )

  drawSprites(ctx, map, line, dpr)

  // マウス位置のマス。Sprite ではスプライトを作成できるマスのみとする
  const tool = hoverTool.value
  const highlight =
    tool === 'sprite'
      ? !gesture.value && hover.value !== null && !spriteAt(current, hover.value.x, hover.value.y)
      : tool !== 'pan' && tool !== 'move' && (tool === 'pick' || editable.value)
  if (hover.value && hoverInside.value && highlight) {
    const { x, y } = hover.value
    // Draw では空のマスに設置されるタイルを半透明で表示する。編集操作中は表示しない
    if (tool === 'draw' && !gesture.value && !editor.tileAt(x, y)) {
      const path = new Path2D()
      appendShapePath(path, selectedShape.value, map.x(x), map.y(y), map.x(x + 1), map.y(y + 1))
      ctx.globalAlpha = PREVIEW_ALPHA
      ctx.fillStyle = selectedColor.value
      ctx.fill(path)
      ctx.globalAlpha = 1
    }
    ctx.strokeStyle = tool === 'erase' ? CANVAS_COLORS.eraseHover : CANVAS_COLORS.hover
    ctx.strokeRect(map.x(x) + line / 2, map.y(y) + line / 2, map.x(x + 1) - map.x(x) - line, map.y(y + 1) - map.y(y) - line)
  }
}

/** 操作中のスプライトは操作後の範囲とする */
function displayedSprites(): { id: string | null; rect: Rect; valid: boolean }[] {
  const draft = spriteDraft.value
  const sprites = doc.value.sprites.map((sprite) =>
    draft && draft.id === sprite.id ? draft : { id: sprite.id, rect: sprite as Rect, valid: true },
  )
  if (draft && draft.id === null) sprites.push(draft)
  return sprites
}

function drawSprites(ctx: CanvasRenderingContext2D, map: ReturnType<typeof deviceMapper>, line: number, dpr: number) {
  const sprites = displayedSprites()
  if (sprites.length === 0) return
  const full = spriteMode.value
  const selectedId = full ? selectedSpriteId.value : null
  ctx.lineWidth = line
  let selected: Rect | null = null
  for (const sprite of sprites) {
    const { rect } = sprite
    const x0 = map.x(rect.x)
    const y0 = map.y(rect.y)
    const x1 = map.x(rect.x + rect.width)
    const y1 = map.y(rect.y + rect.height)
    const isSelected = sprite.id !== null && sprite.id === selectedId
    const active = isSelected || sprite.id === null
    if (!sprite.valid) {
      ctx.fillStyle = CANVAS_COLORS.spriteInvalidFill
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    } else if (full && active) {
      ctx.fillStyle = CANVAS_COLORS.spriteSelectedFill
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
    ctx.strokeStyle = !sprite.valid
      ? CANVAS_COLORS.spriteInvalid
      : full && active
        ? CANVAS_COLORS.spriteSelected
        : full
          ? CANVAS_COLORS.sprite
          : CANVAS_COLORS.spriteDim
    // 隣接するスプライトの境界が重ならないよう、矩形の内側に描く
    ctx.strokeRect(x0 + line / 2, y0 + line / 2, x1 - x0 - line, y1 - y0 - line)
    if (isSelected) selected = rect
  }
  if (!selected || gesture.value?.kind === 'sprite-move') return
  // リサイズ用のハンドル
  const size = Math.round(SPRITE_HANDLE_SIZE * dpr)
  const half = Math.floor(size / 2)
  const left = map.x(selected.x)
  const right = map.x(selected.x + selected.width)
  const top = map.y(selected.y)
  const bottom = map.y(selected.y + selected.height)
  const xs = [left, (left + right) / 2, right]
  const ys = [top, (top + bottom) / 2, bottom]
  const handles = new Path2D()
  for (const [iy, hy] of ys.entries()) {
    for (const [ix, hx] of xs.entries()) {
      if (ix === 1 && iy === 1) continue
      handles.rect(Math.round(hx) - half, Math.round(hy) - half, size, size)
    }
  }
  ctx.fillStyle = CANVAS_COLORS.spriteHandle
  ctx.fill(handles)
  ctx.strokeStyle = CANVAS_COLORS.spriteSelected
  ctx.stroke(handles)
}

watch([doc, revision, tileSize, originX, originY, viewWidth, viewHeight, moveOffset], () => requestRender(true))
watch(
  [hover, hoverTool, gesture, editable, activeLayerId, selectedColor, selectedShape, spriteDraft, selectedSpriteId, spriteMode],
  () => requestRender(false),
)

// ---- スプライトの名前ラベル ----

/** Sprite ツールの選択中のみ、矩形の左上の外側に名前ラベルを表示する */
const spriteLabels = computed(() => {
  if (!spriteMode.value) return []
  const draft = spriteDraft.value
  const size = tileSize.value
  return doc.value.sprites.map((sprite) => {
    const rect = draft && draft.id === sprite.id ? draft.rect : sprite
    return {
      id: sprite.id,
      name: sprite.name,
      selected: sprite.id === selectedSpriteId.value,
      left: Math.round(originX.value + rect.x * size),
      top: Math.round(originY.value + rect.y * size),
    }
  })
})

/** 操作中や一時的に他のツールに切り替えている間は、ラベルを押せないようにする */
const labelsInteractive = computed(() => leftTool.value === 'sprite' && gesture.value === null)

function onLabelClick(id: string) {
  editor.selectSprite(id)
  emit('editSprite', id)
}

// ---- 表示位置 ----

function centerView() {
  originX.value = Math.round((viewWidth.value - doc.value.width * tileSize.value) / 2)
  originY.value = Math.round((viewHeight.value - doc.value.height * tileSize.value) / 2)
}

function resetView() {
  tileSize.value = DEFAULT_TILE_SIZE
  centerView()
}

watch(viewResetToken, resetView)
// リサイズでキャンバスが表示範囲外に出ないよう、サイズが変わったら中央に合わせる
watch(
  () => [doc.value.width, doc.value.height],
  ([width, height], [oldWidth, oldHeight]) => {
    if (width !== oldWidth || height !== oldHeight) centerView()
  },
)

function zoom(direction: 1 | -1, anchorX: number, anchorY: number) {
  const index = TILE_SIZES.indexOf(tileSize.value)
  const nextIndex = Math.min(TILE_SIZES.length - 1, Math.max(0, index + direction))
  if (nextIndex === index) return
  const nextSize = TILE_SIZES[nextIndex]!
  // マウス位置のマス座標を保ったまま拡縮する
  const cellX = (anchorX - originX.value) / tileSize.value
  const cellY = (anchorY - originY.value) / tileSize.value
  tileSize.value = nextSize
  originX.value = anchorX - cellX * nextSize
  originY.value = anchorY - cellY * nextSize
}

let wheelAccumulator = 0
let lastWheelTime = -Infinity

/**
 * マウスホイールのように 1 目盛りごとにイベントが発生する入力か
 * - Firefox は deltaY より先に deltaMode を参照した場合に行単位の値を返すため、先に deltaMode を参照する
 */
function isNotchedWheel(event: WheelEvent): boolean {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true
  const notches = Math.abs(event.deltaY) / MAC_WHEEL_DELTA
  return notches >= 1 && Number.isInteger(notches)
}

/** マウスホイールは 1 目盛りごとに、トラックパッドなどは操作の開始時と移動量が一定に達するごとに 1 段階拡縮する */
function onWheel(event: WheelEvent) {
  event.preventDefault()
  const notched = isNotchedWheel(event)
  const delta = event.deltaY
  const gestureStart = event.timeStamp - lastWheelTime >= WHEEL_GESTURE_GAP
  lastWheelTime = event.timeStamp
  // 主に横方向の操作は拡縮に使わない
  if (delta === 0 || Math.abs(event.deltaX) > Math.abs(delta)) return
  if (Math.sign(delta) !== Math.sign(wheelAccumulator)) wheelAccumulator = 0
  wheelAccumulator += delta
  const threshold = event.ctrlKey ? PINCH_THRESHOLD : WHEEL_THRESHOLD
  if (!notched && !gestureStart && Math.abs(wheelAccumulator) < threshold) return
  wheelAccumulator = 0
  const point = localPoint(event)
  zoom(delta < 0 ? 1 : -1, point.x, point.y)
}

// ---- ポインター操作 ----

function localPoint(event: MouseEvent): { x: number; y: number } {
  const rect = container.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function cellAt(event: MouseEvent): Cell {
  const point = localPoint(event)
  return {
    x: Math.floor((point.x - originX.value) / tileSize.value),
    y: Math.floor((point.y - originY.value) / tileSize.value),
  }
}

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a !== null && b !== null && a.x === b.x && a.y === b.y
}

function isMoveModifierPressed(event: MouseEvent): boolean {
  return IS_MAC ? event.metaKey : event.ctrlKey
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 選択中のスプライトの辺の上か。辺の上でなければ null を返す
 * - 小さなスプライトも移動できるよう、内側でつかめる範囲はスプライトの大きさに応じて狭める
 */
function spriteEdgesAt(point: { x: number; y: number }): SpriteEdges | null {
  const sprite = selectedSprite.value
  if (!sprite || !spriteMode.value) return null
  const size = tileSize.value
  const left = originX.value + sprite.x * size
  const top = originY.value + sprite.y * size
  const right = left + sprite.width * size
  const bottom = top + sprite.height * size
  const insideX = Math.min(SPRITE_EDGE_HIT, (right - left) / 3)
  const insideY = Math.min(SPRITE_EDGE_HIT, (bottom - top) / 3)
  if (point.x < left - SPRITE_EDGE_HIT || point.x > right + SPRITE_EDGE_HIT) return null
  if (point.y < top - SPRITE_EDGE_HIT || point.y > bottom + SPRITE_EDGE_HIT) return null
  const edges: SpriteEdges = {
    left: point.x <= left + insideX && point.x - left < right - point.x,
    right: point.x >= right - insideX && right - point.x <= point.x - left,
    top: point.y <= top + insideY && point.y - top < bottom - point.y,
    bottom: point.y >= bottom - insideY && bottom - point.y <= point.y - top,
  }
  return edges.left || edges.right || edges.top || edges.bottom ? edges : null
}

/** Sprite ツールの左クリック。辺の上ならリサイズ、スプライトの上なら選択して移動、空のマスなら作成を始める */
function beginSpriteGesture(event: PointerEvent, cell: Cell): boolean {
  const point = localPoint(event)
  const edges = spriteEdgesAt(point)
  const selected = selectedSprite.value
  if (edges && selected) {
    gesture.value = { kind: 'sprite-resize', pointerId: event.pointerId, id: selected.id, origin: selected, edges }
    return true
  }
  const sprite = spriteAt(doc.value, cell.x, cell.y)
  if (sprite) {
    editor.selectSprite(sprite.id)
    gesture.value = { kind: 'sprite-move', pointerId: event.pointerId, id: sprite.id, start: cell, origin: sprite }
    return true
  }
  editor.selectSprite(null)
  if (!isInside(doc.value, cell.x, cell.y)) return false
  gesture.value = { kind: 'sprite-create', pointerId: event.pointerId, start: cell }
  return true
}

function updateSpriteDraft(id: string | null, rect: Rect) {
  const draft = spriteDraft.value
  if (draft && draft.id === id && sameRect(draft.rect, rect)) return
  spriteDraft.value = { id, rect, valid: canPlaceSprite(doc.value, rect, id ?? undefined) }
}

/** Sprite ツールのドラッグ。範囲はキャンバス内に収め、他のスプライトと重なる場合は無効とする */
function continueSpriteGesture(
  current: Extract<Gesture, { kind: 'sprite-create' | 'sprite-move' | 'sprite-resize' }>,
  event: PointerEvent,
  cell: Cell,
) {
  const { width, height } = doc.value
  if (current.kind === 'sprite-create') {
    const end = { x: clamp(cell.x, 0, width - 1), y: clamp(cell.y, 0, height - 1) }
    // 押下したマスから移動するまでは作成しない
    if (spriteDraft.value === null && sameCell(current.start, end)) return
    updateSpriteDraft(null, rectFromCells(current.start, end))
  } else if (current.kind === 'sprite-move') {
    const { origin } = current
    const dx = cell.x - current.start.x
    const dy = cell.y - current.start.y
    if (spriteDraft.value === null && dx === 0 && dy === 0) return
    updateSpriteDraft(current.id, {
      x: clamp(origin.x + dx, 0, width - origin.width),
      y: clamp(origin.y + dy, 0, height - origin.height),
      width: origin.width,
      height: origin.height,
    })
  } else {
    // つかんだ辺をマウス位置に最も近いマスの境界に合わせる
    const point = localPoint(event)
    const bx = clamp(Math.round((point.x - originX.value) / tileSize.value), 0, width)
    const by = clamp(Math.round((point.y - originY.value) / tileSize.value), 0, height)
    const { origin, edges } = current
    let x0 = origin.x
    let y0 = origin.y
    let x1 = origin.x + origin.width
    let y1 = origin.y + origin.height
    if (edges.left) x0 = Math.min(bx, x1 - 1)
    if (edges.right) x1 = Math.max(bx, x0 + 1)
    if (edges.top) y0 = Math.min(by, y1 - 1)
    if (edges.bottom) y1 = Math.max(by, y0 + 1)
    updateSpriteDraft(current.id, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 })
  }
}

function onPointerDown(event: PointerEvent) {
  if (gesture.value || !container.value) return
  altHeld.value = event.altKey
  moveKeyHeld.value = isMoveModifierPressed(event)
  // 右クリックはツールによらず Erase とする
  const tool = event.button === 0 ? leftTool.value : event.button === 2 ? 'erase' : null
  if (!tool) return
  const cell = cellAt(event)
  if (tool === 'pick') {
    // Pick ツールで拾った場合は Draw に戻る。Alt キーによる一時的な切り替えではツールを変えない
    if (editor.pickAt(cell.x, cell.y) && activeTool.value === 'pick') editor.selectTool('draw')
    event.preventDefault()
    return
  }
  if (tool === 'fill') {
    // 1 回のクリックで完結するため、ドラッグは扱わない
    editor.fillAt(cell.x, cell.y)
    event.preventDefault()
    return
  }
  if (tool === 'sprite') {
    // タイルは編集しないため、アクティブなレイヤーが非表示でも使える
    if (!beginSpriteGesture(event, cell)) {
      event.preventDefault()
      return
    }
  } else if (tool === 'pan') {
    gesture.value = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: originX.value,
      originY: originY.value,
    }
  } else if (tool === 'draw') {
    if (!editor.beginStroke()) return
    let pendingRotate: Cell | null = null
    const tile = editor.tileAt(cell.x, cell.y)
    if (tile && tile.color === selectedColor.value) {
      // 同じ色のタイルは、移動せずに離した時点で回転させる
      pendingRotate = cell
    } else {
      editor.paintAt(cell.x, cell.y)
    }
    gesture.value = { kind: 'paint', pointerId: event.pointerId, last: cell, pendingRotate }
  } else if (tool === 'move') {
    if (!editor.beginStroke()) return
    gesture.value = { kind: 'move', pointerId: event.pointerId, start: cell }
    moveOffset.value = { x: 0, y: 0 }
  } else {
    if (!editor.beginStroke()) return
    editor.eraseAt(cell.x, cell.y)
    gesture.value = { kind: 'erase', pointerId: event.pointerId, last: cell }
  }
  container.value.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
  const current = gesture.value
  if (current?.kind === 'pan') {
    if (current.pointerId !== event.pointerId) return
    originX.value = current.originX + event.clientX - current.startX
    originY.value = current.originY + event.clientY - current.startY
    return
  }
  altHeld.value = event.altKey
  moveKeyHeld.value = isMoveModifierPressed(event)
  hoverPoint.value = localPoint(event)
  const cell = cellAt(event)
  if (!sameCell(hover.value, cell)) hover.value = cell
  if (!current || current.pointerId !== event.pointerId) return
  if (current.kind === 'sprite-create' || current.kind === 'sprite-move' || current.kind === 'sprite-resize') {
    continueSpriteGesture(current, event, cell)
    return
  }
  if (current.kind === 'move') {
    const offset = { x: cell.x - current.start.x, y: cell.y - current.start.y }
    if (!sameCell(moveOffset.value, offset)) moveOffset.value = offset
    return
  }
  if (sameCell(current.last, cell)) return

  // 素早く動かしても途切れないよう、前回のマスから直線上のマスをすべて処理する
  for (const step of lineCells(current.last, cell)) {
    if (current.kind === 'paint') {
      editor.paintAt(step.x, step.y)
    } else {
      editor.eraseAt(step.x, step.y)
    }
  }
  if (current.kind === 'paint') current.pendingRotate = null
  current.last = cell
}

function finishGesture(event: PointerEvent, cancelled: boolean) {
  const current = gesture.value
  if (!current || current.pointerId !== event.pointerId) return
  gesture.value = null
  if (container.value?.hasPointerCapture(event.pointerId)) {
    container.value.releasePointerCapture(event.pointerId)
  }
  if (current.kind === 'pan') return
  if (current.kind === 'sprite-create' || current.kind === 'sprite-move' || current.kind === 'sprite-resize') {
    const draft = spriteDraft.value
    spriteDraft.value = null
    // 離した時点で確定する。他のスプライトと重なる場合は確定しない
    if (cancelled || !draft?.valid) return
    if (draft.id === null) {
      editor.addSprite(draft.rect)
    } else {
      editor.setSpriteRect(draft.id, draft.rect)
    }
    return
  }
  if (current.kind === 'move') {
    const offset = moveOffset.value
    moveOffset.value = null
    // 離した時点で確定し、キャンバス範囲外に出たタイルは削除する
    if (!cancelled && offset) editor.moveTiles(offset.x, offset.y)
  } else if (!cancelled && current.kind === 'paint' && current.pendingRotate) {
    editor.rotateAt(current.pendingRotate.x, current.pendingRotate.y)
  }
  editor.endStroke()
}

function onPointerUp(event: PointerEvent) {
  finishGesture(event, false)
}

function onPointerCancel(event: PointerEvent) {
  finishGesture(event, true)
}

function onPointerLeave() {
  if (gesture.value) return
  hover.value = null
  hoverPoint.value = null
}

// ---- キーボード ----

function onKeyDown(event: KeyboardEvent) {
  if (props.locked || isEditableTarget(event.target)) return
  if (event.key === 'Alt') {
    altHeld.value = true
    return
  }
  if (event.key === MOVE_MODIFIER_KEY) {
    moveKeyHeld.value = true
    return
  }
  if (event.code !== 'Space') return
  // ページのスクロールやフォーカス中のボタンの押下を防ぐ
  event.preventDefault()
  spaceHeld.value = true
}

function onKeyUp(event: KeyboardEvent) {
  if (event.key === 'Alt') {
    altHeld.value = false
    return
  }
  if (event.key === MOVE_MODIFIER_KEY) {
    moveKeyHeld.value = false
    return
  }
  if (event.code !== 'Space') return
  if (!isEditableTarget(event.target)) event.preventDefault()
  spaceHeld.value = false
}

function onBlur() {
  spaceHeld.value = false
  altHeld.value = false
  moveKeyHeld.value = false
}

watch(
  () => props.locked,
  (locked) => {
    if (locked) {
      spaceHeld.value = false
      altHeld.value = false
      moveKeyHeld.value = false
      hover.value = null
      hoverPoint.value = null
    }
  },
)

// ---- ライフサイクル ----

let resizeObserver: ResizeObserver | null = null
let centered = false

function onDevicePixelRatioChange() {
  requestRender(true)
}

let dprQuery: MediaQueryList | null = null

function watchDevicePixelRatio() {
  dprQuery?.removeEventListener('change', watchDevicePixelRatio)
  dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  dprQuery.addEventListener('change', watchDevicePixelRatio)
  onDevicePixelRatioChange()
}

onMounted(() => {
  const el = container.value!
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    viewWidth.value = entry.contentRect.width
    viewHeight.value = entry.contentRect.height
    if (!centered && viewWidth.value > 0 && viewHeight.value > 0) {
      centered = true
      resetView()
    }
  })
  resizeObserver.observe(el)
  el.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  watchDevicePixelRatio()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  container.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  dprQuery?.removeEventListener('change', watchDevicePixelRatio)
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    ref="container"
    class="editor-canvas"
    :style="{ cursor }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerLeave"
    @contextmenu.prevent
  >
    <canvas ref="mainCanvas" class="editor-canvas__layer" />
    <canvas ref="overlayCanvas" class="editor-canvas__layer" />
    <button
      v-for="label in spriteLabels"
      :key="label.id"
      type="button"
      class="sprite-label"
      :class="{ 'sprite-label--selected': label.selected, 'sprite-label--inert': !labelsInteractive }"
      :style="{ transform: `translate(${label.left}px, ${label.top}px) translateY(-100%)` }"
      :title="`Rename ${label.name}`"
      :tabindex="labelsInteractive ? 0 : -1"
      @pointerdown.stop
      @click="onLabelClick(label.id)"
    >
      {{ label.name }}
    </button>
    <p class="status" aria-live="off">
      <span>{{ doc.width }} × {{ doc.height }}</span>
      <span>{{ tileSize }}px</span>
      <span v-if="hover && hoverInside">{{ hover.x }}, {{ hover.y }}</span>
    </p>
  </div>
</template>

<style scoped>
.editor-canvas {
  position: relative;
  overflow: hidden;
  background: #141518;
  touch-action: none;
  user-select: none;
}

.editor-canvas__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.sprite-label {
  position: absolute;
  top: 0;
  left: 0;
  max-width: 200px;
  padding: 1px 6px;
  overflow: hidden;
  border: none;
  border-radius: 3px 3px 0 0;
  background: rgb(60 150 210 / 85%);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.sprite-label:hover {
  background: rgb(80 170 230 / 95%);
}

.sprite-label--selected,
.sprite-label--selected:hover {
  background: var(--color-accent);
}

.sprite-label--inert {
  pointer-events: none;
}

.status {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 12px;
  padding: 4px 10px;
  border-radius: var(--radius);
  background: rgb(20 21 24 / 80%);
  color: var(--color-text-dim);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
