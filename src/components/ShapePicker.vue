<script setup lang="ts">
import { SHAPE_ORDER, Shape } from '../model/types'
import { editor } from '../store/editor'

const { selectedShape } = editor

/** points は 16×16 の枠内の多角形 */
const SHAPE_ICONS: Record<Shape, { label: string; points: string }> = {
  [Shape.Square]: { label: 'Square', points: '2,2 14,2 14,14 2,14' },
  [Shape.TopLeft]: { label: 'Top-left triangle', points: '2,2 14,2 2,14' },
  [Shape.TopRight]: { label: 'Top-right triangle', points: '2,2 14,2 14,14' },
  [Shape.BottomRight]: { label: 'Bottom-right triangle', points: '14,2 14,14 2,14' },
  [Shape.BottomLeft]: { label: 'Bottom-left triangle', points: '2,2 14,14 2,14' },
}

/** ローテーションと同じ順に並べる */
const SHAPES = SHAPE_ORDER.map((shape) => ({ shape, ...SHAPE_ICONS[shape] }))
</script>

<template>
  <section class="sidebar-section" aria-labelledby="shapes-title">
    <h2 id="shapes-title" class="sidebar-title">Shapes</h2>
    <div class="choice-list" role="listbox" aria-label="Tile shape">
      <button
        v-for="item in SHAPES"
        :key="item.shape"
        type="button"
        class="choice-button"
        :class="{ 'choice-button--selected': item.shape === selectedShape }"
        :title="item.label"
        role="option"
        :aria-selected="item.shape === selectedShape"
        :aria-label="item.label"
        @click="editor.selectShape(item.shape)"
      >
        <svg class="shape__icon" viewBox="0 0 16 16" aria-hidden="true">
          <polygon :points="item.points" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.shape__icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>
