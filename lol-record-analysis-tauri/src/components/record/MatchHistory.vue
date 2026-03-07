<template>
  <div class="ratio-container">
    <n-flex vertical class="content-wrapper match-history-wrap">
      <n-flex class="match-history-toolbar" align="center" :size="8">
        <n-select
          v-model:value="filterQueueId"
          placeholder="按模式筛选"
          :options="modeOptions"
          size="small"
          class="filter-select filter-mode"
          @update:value="handleUpdateValue"
        />
        <n-select
          v-model:value="filterChampionId"
          filterable
          :filter="filterChampionFunc"
          placeholder="按英雄筛选"
          :render-tag="renderSingleSelectTag"
          :render-label="renderLabel"
          :options="championOptions"
          size="small"
          class="filter-select filter-champion"
          @update:value="handleUpdateValue"
        />
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary circle size="small" class="toolbar-reset" @click="resetFilter">
              <n-icon><RepeatOutline /></n-icon>
            </n-button>
          </template>
          复位
        </n-tooltip>
      </n-flex>

      <TransitionGroup name="list" tag="div" class="match-history-list">
        <div
          v-for="(game, index) in matchHistory?.games?.games || []"
          :key="game.gameId"
          :style="{ '--stagger-i': index }"
          class="list-item"
        >
          <RecordCard :record-type="true" :games="game" @open-detail="openDetail(game)" />
        </div>
      </TransitionGroup>

      <div class="pagination">
        <n-pagination>
          <template #prev>
            <n-button
              size="tiny"
              :disabled="page == 1 || isRequestingMatchHostory"
              @click="prevPage"
            >
              <template #icon>
                <n-icon>
                  <ArrowBack></ArrowBack>
                </n-icon>
              </template>
            </n-button>
          </template>
          <template #label>
            <span>{{ page }}</span>
          </template>
          <template #next>
            <n-button
              size="tiny"
              @click="nextPage"
              :disabled="page == 5 || isRequestingMatchHostory"
            >
              <template #icon>
                <n-icon>
                  <ArrowForward></ArrowForward>
                </n-icon>
              </template>
            </n-button>
          </template>
        </n-pagination>
      </div>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import RecordCard from './RecordCard.vue'
import { ArrowBack, ArrowForward, RepeatOutline } from '@vicons/ionicons5'
import { onMounted, ref } from 'vue'
import { useLoadingBar } from 'naive-ui'
import { useRoute } from 'vue-router'
import { renderSingleSelectTag, renderLabel, filterChampionFunc } from '../composition'
import { modeOptions, initModeOptions } from './composition'
import { invoke } from '@tauri-apps/api/core'
import { championOption } from '../type'
import type { Game, MatchHistory } from './match'
import { openMatchDetailWindow } from './detailWindow'

const filterQueueId = ref(0)
const filterChampionId = ref(-1)
const championOptions = ref<championOption[]>([])

const resetFilter = () => {
  pageHistory.value = []
  filterQueueId.value = 0
  filterChampionId.value = -1
  handleUpdateValue()
}
const handleUpdateValue = () => {
  page.value = 1
  if (filterChampionId.value > 0 || filterQueueId.value > 0) {
    getHistoryMatch(route.query.name as string, 0, 49)
  } else {
    getHistoryMatch(route.query.name as string, 0, 9)
  }
}

const matchHistory = ref<MatchHistory>()
const loadingBar = useLoadingBar()
const isRequestingMatchHostory = ref(false)
const page = ref(1)
const pageHistory = ref<{ begIndex: number; endIndex: number }[]>([])

let curBegIndex = 0
let curEndIndex = 0

const route = useRoute()
let name = ''

async function openDetail(game: Game) {
  await openMatchDetailWindow(game)
}

// 获取历史记录
const getHistoryMatch = async (name: string, begIndex: number, endIndex: number) => {
  loadingBar.start()
  isRequestingMatchHostory.value = true
  try {
    if (filterChampionId.value > 0 || filterQueueId.value > 0) {
      matchHistory.value = await invoke('get_filter_match_history_by_name', {
        name,
        begIndex,
        endIndex,
        filterQueueId: filterQueueId.value,
        filterChampionId: filterChampionId.value
      })
    } else {
      matchHistory.value = await invoke('get_match_history_by_name', {
        name,
        begIndex,
        endIndex
      })
    }
    if (matchHistory.value) {
      curBegIndex = matchHistory.value.begIndex
      curEndIndex = matchHistory.value.endIndex
    }
  } finally {
    isRequestingMatchHostory.value = false
    loadingBar.finish()
  }
}

// 下一页
const nextPage = async () => {
  let begIndex = 0
  let endIndex = 0
  pageHistory.value.push({ begIndex: curBegIndex, endIndex: curEndIndex })

  if (filterQueueId.value > 0 || filterChampionId.value > 0) {
    begIndex = curEndIndex + 1
    endIndex = 49
  } else {
    begIndex = page.value * 10
    endIndex = begIndex + 9
  }

  await getHistoryMatch(name, begIndex, endIndex)
  page.value++
}

// 上一页
const prevPage = async () => {
  const lastPage = pageHistory.value.pop()

  if (!lastPage) {
    throw new Error('无上一页数据')
  }
  await getHistoryMatch(name, lastPage.begIndex, lastPage.endIndex)
  page.value = Math.max(1, page.value - 1)
}

onMounted(async () => {
  await initModeOptions()
  championOptions.value = await invoke<championOption[]>('get_champion_options')
})

onMounted(async () => {
  name = route.query.name as string
  await getHistoryMatch(name, 0, 9)
})
</script>

<style lang="css" scoped>
.ratio-container {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.match-history-wrap.content-wrapper {
  height: 100%;
  position: relative;
  gap: var(--space-20);
}

.match-history-toolbar {
  flex-shrink: 0;
}

.match-history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-20);
}

.list-item {
  /* TransitionGroup child; stagger via --stagger-i */
}

.list-enter-active {
  transition:
    opacity var(--transition-normal) var(--ease-out-expo),
    transform var(--transition-normal) var(--ease-out-expo);
  transition-delay: calc(var(--stagger-step) * var(--stagger-i, 0));
}

.list-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.list-move {
  transition: transform var(--transition-normal);
}

.filter-select.filter-mode {
  width: 100px;
  margin-left: var(--space-8);
}

.filter-select.filter-champion {
  width: 170px;
}

.filter-select :deep(.n-input),
.filter-select :deep(.n-input-wrapper) {
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.filter-select:focus-within :deep(.n-input-wrapper) {
  box-shadow: 0 0 0 1px var(--border-subtle);
}

.toolbar-reset {
  color: var(--text-secondary);
  transition:
    transform var(--transition-fast),
    color var(--transition-fast);
}

.toolbar-reset:hover {
  transform: scale(1.05);
}

.toolbar-reset:active {
  transform: scale(0.98);
}

.content-wrapper {
  aspect-ratio: 1.1 / 1;
  width: 100%;
  max-width: calc(100vh * 1.1);
  max-height: calc(100vw / 1.1);
  margin: auto;
  position: relative;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  margin: var(--space-8) 0;
}

.pagination {
  position: sticky;
  bottom: 0;
  background: var(--bg-base);
  padding: var(--space-8) 0;
  margin-top: var(--space-8);
}

.pagination :deep(.n-button) {
  transition: transform var(--transition-fast);
}

.pagination :deep(.n-button:hover:not(:disabled)) {
  transform: scale(1.05);
}

.pagination :deep(.n-button:active:not(:disabled)) {
  transform: scale(0.98);
}
</style>
