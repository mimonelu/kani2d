import { createApp } from 'vue'
import App from './App.vue'
import { setupAutosave } from './storage/autosave'
import { editor } from './store/editor'
import './styles.css'

// 復元後にマウントし、初期状態が一瞬表示されるのを防ぐ
setupAutosave(editor).finally(() => {
  createApp(App).mount('#app')
})
