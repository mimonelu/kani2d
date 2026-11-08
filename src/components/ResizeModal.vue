<script setup lang="ts">
import { computed, ref } from 'vue'
import { isValidCanvasSize } from '../model/document'
import { editor } from '../store/editor'
import BaseModal from './BaseModal.vue'

const emit = defineEmits<{
  close: []
}>()

const { doc } = editor

// type="number" の v-model は数値に変換されることがあるため両方を受け付ける
const widthInput = ref<string | number>(doc.value.width)
const heightInput = ref<string | number>(doc.value.height)

function parseSize(input: string | number): number | null {
  const text = String(input).trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return isValidCanvasSize(value) ? value : null
}

const width = computed(() => parseSize(widthInput.value))
const height = computed(() => parseSize(heightInput.value))
const valid = computed(() => width.value !== null && height.value !== null)

const removedCount = computed(() => {
  if (!valid.value) return 0
  let count = 0
  for (const layer of doc.value.layers) {
    for (const tile of layer.tiles.values()) {
      if (tile.x >= width.value! || tile.y >= height.value!) count++
    }
  }
  return count
})

function submit() {
  if (!valid.value) return
  editor.resize(width.value!, height.value!)
  emit('close')
}
</script>

<template>
  <BaseModal title="Resize Canvas" @close="emit('close')">
    <form id="resize-form" class="form" @submit.prevent="submit">
      <div class="fields">
        <label class="field">
          <span class="field__label">Width (tiles)</span>
          <input
            v-model="widthInput"
            class="text-input"
            type="number"
            min="1"
            step="1"
            required
            autofocus
            :aria-invalid="width === null"
          />
        </label>
        <span class="times">×</span>
        <label class="field">
          <span class="field__label">Height (tiles)</span>
          <input
            v-model="heightInput"
            class="text-input"
            type="number"
            min="1"
            step="1"
            required
            :aria-invalid="height === null"
          />
        </label>
      </div>
      <p class="note">The top-left corner stays in place.</p>
      <p v-if="!valid" class="error-text">Enter whole numbers of 1 or more.</p>
      <p v-else-if="removedCount > 0" class="error-text">
        {{ removedCount }} {{ removedCount === 1 ? 'tile' : 'tiles' }} outside the new size will be removed.
      </p>
    </form>
    <template #footer>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button type="submit" form="resize-form" class="button button--primary" :disabled="!valid">Resize</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

.note {
  color: var(--color-text-dim);
}
</style>
