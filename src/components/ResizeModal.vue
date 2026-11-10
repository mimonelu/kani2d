<script setup lang="ts">
import { computed, ref } from 'vue'
import { CENTER_ANCHOR } from '../model/constants'
import { countSpritesChangedByResize, countTilesRemovedByResize, parseCanvasSize } from '../model/document'
import type { ResizeAnchor } from '../model/types'
import { editor } from '../store/editor'
import AnchorPicker from './AnchorPicker.vue'
import BaseModal from './BaseModal.vue'
import CanvasSizeFields from './CanvasSizeFields.vue'

const emit = defineEmits<{
  close: []
}>()

const { doc } = editor

const widthInput = ref<string | number>(doc.value.width)
const heightInput = ref<string | number>(doc.value.height)
const anchor = ref<ResizeAnchor>(CENTER_ANCHOR)

const width = computed(() => parseCanvasSize(widthInput.value))
const height = computed(() => parseCanvasSize(heightInput.value))
const valid = computed(() => width.value !== null && height.value !== null)

const removedCount = computed(() =>
  width.value === null || height.value === null
    ? 0
    : countTilesRemovedByResize(doc.value, width.value, height.value, anchor.value),
)

const spriteChanges = computed(() =>
  width.value === null || height.value === null
    ? { cropped: 0, removed: 0 }
    : countSpritesChangedByResize(doc.value, width.value, height.value, anchor.value),
)

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function submit() {
  if (width.value === null || height.value === null) return
  editor.resize(width.value, height.value, anchor.value)
  emit('close')
}
</script>

<template>
  <BaseModal title="Resize Canvas" @close="emit('close')">
    <form id="resize-form" class="form" @submit.prevent="submit">
      <CanvasSizeFields v-model:width="widthInput" v-model:height="heightInput" autofocus />
      <AnchorPicker
        v-model="anchor"
        :shrink-x="width !== null && width < doc.width"
        :shrink-y="height !== null && height < doc.height"
      />
      <p v-if="!valid" class="error-text">Enter whole numbers of 1 or more.</p>
      <template v-else>
        <p v-if="removedCount > 0" class="error-text">
          {{ plural(removedCount, 'tile', 'tiles') }} outside the new size will be removed.
        </p>
        <p v-if="spriteChanges.removed > 0" class="error-text">
          {{ plural(spriteChanges.removed, 'sprite', 'sprites') }} outside the new size will be removed.
        </p>
        <p v-if="spriteChanges.cropped > 0" class="error-text">
          {{ plural(spriteChanges.cropped, 'sprite', 'sprites') }} will be cropped to the new size.
        </p>
      </template>
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
</style>
