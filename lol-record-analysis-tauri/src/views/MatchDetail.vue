<template>
  <div class="match-detail-window-page">
    <div class="match-detail-window-bar">
      <div class="match-detail-window-title">对局详情</div>
      <button class="match-detail-window-close" type="button" @click="closeWindow">关闭</button>
    </div>
    <div class="match-detail-window-body">
      <MatchDetailModal :game="game" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import MatchDetailModal from '../components/record/MatchDetailModal.vue'
import type { Game } from '../components/record/match'

const route = useRoute()
const game = ref<Game | null>(null)
const currentWindow = getCurrentWindow()

function getStorageKeyFromWindowLabel() {
  if (!currentWindow.label.startsWith('match-detail-')) {
    return undefined
  }

  return currentWindow.label.replace('match-detail-', 'match-detail:')
}

function readGameFromStorage(storageKey?: string | null) {
  if (!storageKey) {
    game.value = null
    return
  }

  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    game.value = null
    return
  }

  try {
    game.value = JSON.parse(raw) as Game
  } catch (error) {
    console.error('Failed to parse match detail payload:', error)
    game.value = null
  }
}

onMounted(async () => {
  const storageKey =
    (route.query.storageKey as string | undefined) ?? getStorageKeyFromWindowLabel()
  readGameFromStorage(storageKey)
})

function closeWindow() {
  currentWindow.close()
}
</script>

<style scoped>
.match-detail-window-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
}

.match-detail-window-bar {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 6px 0 10px;
  box-sizing: border-box;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--semantic-win) 12%, var(--bg-surface)),
      var(--bg-surface)
    ),
    var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  -webkit-app-region: drag;
}

.match-detail-window-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.match-detail-window-close {
  height: 20px;
  padding: 0 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  color: var(--text-primary);
  font-size: 10px;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
  -webkit-app-region: no-drag;
}

.match-detail-window-close:hover {
  background: color-mix(in srgb, var(--semantic-loss) 18%, transparent);
  border-color: color-mix(in srgb, var(--semantic-loss) 35%, var(--border-subtle));
}

.theme-light .match-detail-window-bar {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--semantic-win) 10%, var(--bg-surface)),
      var(--bg-surface)
    ),
    var(--bg-surface);
}

.match-detail-window-body {
  flex: 1;
  min-height: 0;
}
</style>
