<script setup lang="ts">
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
} from '@lucide/vue'
import { computed, type Component } from 'vue'
import type { AnchorPosition, ResizeAnchor } from '../model/types'

const props = defineProps<{
  /** 幅を縮小するか。縮小する軸では矢印を内向きにする */
  shrinkX: boolean
  /** 高さを縮小するか */
  shrinkY: boolean
}>()

const anchor = defineModel<ResizeAnchor>({ required: true })

const POSITIONS: readonly AnchorPosition[] = [0, 0.5, 1]

const LABELS = ['Top left', 'Top', 'Top right', 'Left', 'Center', 'Right', 'Bottom left', 'Bottom', 'Bottom right']

/** キーは矢印の向き `x,y`（各 -1, 0, 1） */
const ARROWS: Record<string, Component> = {
  '-1,-1': ArrowUpLeft,
  '0,-1': ArrowUp,
  '1,-1': ArrowUpRight,
  '-1,0': ArrowLeft,
  '1,0': ArrowRight,
  '-1,1': ArrowDownLeft,
  '0,1': ArrowDown,
  '1,1': ArrowDownRight,
}

/** 基準位置に印を付け、隣接するボタンにキャンバスが広がる向きの矢印を表示する */
const cells = computed(() =>
  POSITIONS.flatMap((y, row) =>
    POSITIONS.map((x, column) => {
      const dx = column - anchor.value.x * 2
      const dy = row - anchor.value.y * 2
      const selected = dx === 0 && dy === 0
      const adjacent = !selected && Math.abs(dx) <= 1 && Math.abs(dy) <= 1
      const arrowX = props.shrinkX ? -dx : dx
      const arrowY = props.shrinkY ? -dy : dy
      // -0 は文字列化すると "0" になる
      const arrow = adjacent ? ARROWS[`${arrowX},${arrowY}`] : undefined
      return { key: row * 3 + column, anchor: { x, y }, label: LABELS[row * 3 + column], selected, arrow }
    }),
  ),
)
</script>

<template>
  <div class="field">
    <span id="anchor-picker-label" class="field__label">Anchor</span>
    <div class="anchor-grid" role="group" aria-labelledby="anchor-picker-label">
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="choice-button"
        :class="{ 'choice-button--selected': cell.selected }"
        :title="cell.label"
        :aria-label="cell.label"
        :aria-pressed="cell.selected"
        @click="anchor = cell.anchor"
      >
        <span v-if="cell.selected" class="anchor-mark" aria-hidden="true" />
        <component :is="cell.arrow" v-else-if="cell.arrow" :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.anchor-grid {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: 4px;
}

.anchor-mark {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: currentColor;
}
</style>
