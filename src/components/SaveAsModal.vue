<script setup lang="ts">
import { computed, ref } from 'vue'
import { FALLBACK_FILE_NAME, FILE_EXTENSION } from '../model/constants'
import { normalizeFileName } from '../model/fileFormat'
import BaseModal from './BaseModal.vue'

const emit = defineEmits<{
  close: []
  save: [name: string]
}>()

const nameInput = ref(FALLBACK_FILE_NAME)
const name = computed(() => normalizeFileName(nameInput.value))

function selectAll(event: FocusEvent) {
  const input = event.target as HTMLInputElement
  input.select()
}

function submit() {
  if (name.value === undefined) return
  emit('save', name.value)
}
</script>

<template>
  <BaseModal title="Save As" @close="emit('close')">
    <form id="save-as-form" class="form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">File name</span>
        <span class="name">
          <input
            v-model="nameInput"
            class="text-input name__input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            required
            autofocus
            :aria-invalid="name === undefined"
            @focus="selectAll"
          />
          <span class="name__extension">{{ FILE_EXTENSION }}</span>
        </span>
      </label>
      <p v-if="name === undefined" class="error-text">Enter a file name.</p>
    </form>
    <template #footer>
      <button type="button" class="button" @click="emit('close')">Cancel</button>
      <button type="submit" form="save-as-form" class="button button--primary" :disabled="name === undefined">
        Save
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

.name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name__input {
  flex: 1;
  min-width: 0;
}

.name__extension {
  color: var(--color-text-dim);
}
</style>
