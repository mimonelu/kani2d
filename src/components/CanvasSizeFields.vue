<script setup lang="ts">
import { computed } from 'vue'
import { parseCanvasSize } from '../model/document'

defineProps<{
  /** 幅の入力欄に初期フォーカスを当てるか */
  autofocus?: boolean
}>()

// type="number" の v-model は数値に変換されることがあるため両方を受け付ける
const width = defineModel<string | number>('width', { required: true })
const height = defineModel<string | number>('height', { required: true })

const widthInvalid = computed(() => parseCanvasSize(width.value) === null)
const heightInvalid = computed(() => parseCanvasSize(height.value) === null)
</script>

<template>
  <div class="fields">
    <label class="field">
      <span class="field__label">Width (tiles)</span>
      <input
        v-model="width"
        class="text-input"
        type="number"
        min="1"
        step="1"
        required
        :autofocus="autofocus"
        :aria-invalid="widthInvalid"
      />
    </label>
    <span class="times">×</span>
    <label class="field">
      <span class="field__label">Height (tiles)</span>
      <input
        v-model="height"
        class="text-input"
        type="number"
        min="1"
        step="1"
        required
        :aria-invalid="heightInvalid"
      />
    </label>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.fields .field {
  flex: 1;
}

.times {
  padding-bottom: 7px;
  color: var(--color-text-dim);
}
</style>
