<script setup lang="ts">
import { computed, ref } from 'vue'
import { INVALID_SPRITE_NAME_CHARS, validateSpriteName } from '../model/sprites'
import type { Sprite } from '../model/types'
import { editor } from '../store/editor'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  sprite: Sprite
}>()

const emit = defineEmits<{
  close: []
}>()

const nameInput = ref(props.sprite.name)
const nameError = computed(() => validateSpriteName(editor.doc.value.sprites, nameInput.value, props.sprite.id))
const errorMessage = computed(() => {
  switch (nameError.value) {
    case 'empty':
      return 'Enter a name.'
    case 'invalid':
      return `Names cannot contain ${INVALID_SPRITE_NAME_CHARS.join(' ')}`
    case 'duplicate':
      return 'Another sprite already has this name (letter case is ignored).'
    default:
      return null
  }
})

function selectAll(event: FocusEvent) {
  const input = event.target as HTMLInputElement
  input.select()
}

function submit() {
  if (nameError.value !== null) return
  editor.renameSprite(props.sprite.id, nameInput.value)
  emit('close')
}

function remove() {
  editor.deleteSprite(props.sprite.id)
  emit('close')
}
</script>

<template>
  <BaseModal title="Sprite" @close="emit('close')">
    <form id="sprite-form" class="form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">Name</span>
        <input
          v-model="nameInput"
          class="text-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          required
          autofocus
          :aria-invalid="nameError !== null"
          @focus="selectAll"
        />
      </label>
      <p class="info">
        Position {{ sprite.x }}, {{ sprite.y }} · Size {{ sprite.width }} × {{ sprite.height }} tiles
      </p>
      <p v-if="errorMessage !== null" class="error-text">{{ errorMessage }}</p>
    </form>
    <template #footer>
      <button type="button" class="button footer-start" @click="remove">Delete</button>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button type="submit" form="sprite-form" class="button button--primary" :disabled="nameError !== null">
        Apply
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info {
  color: var(--color-text-dim);
}

.footer-start {
  margin-right: auto;
}
</style>
