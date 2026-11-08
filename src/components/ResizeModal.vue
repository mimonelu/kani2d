<script setup lang="ts">
import { computed, ref } from 'vue'
import { countTilesRemovedByResize, parseCanvasSize } from '../model/document'
import { editor } from '../store/editor'
import BaseModal from './BaseModal.vue'
import CanvasSizeFields from './CanvasSizeFields.vue'

const emit = defineEmits<{
  close: []
}>()

const { doc } = editor

const widthInput = ref<string | number>(doc.value.width)
const heightInput = ref<string | number>(doc.value.height)

const width = computed(() => parseCanvasSize(widthInput.value))
const height = computed(() => parseCanvasSize(heightInput.value))
const valid = computed(() => width.value !== null && height.value !== null)

const removedCount = computed(() =>
  width.value === null || height.value === null ? 0 : countTilesRemovedByResize(doc.value, width.value, height.value),
)

function submit() {
  if (width.value === null || height.value === null) return
  editor.resize(width.value, height.value)
  emit('close')
}
</script>

<template>
  <BaseModal title="Resize Canvas" @close="emit('close')">
    <form id="resize-form" class="form" @submit.prevent="submit">
      <CanvasSizeFields v-model:width="widthInput" v-model:height="heightInput" autofocus />
      <p class="note">The canvas is resized around its center.</p>
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

.note {
  color: var(--color-text-dim);
}
</style>
