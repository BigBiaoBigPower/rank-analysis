<template>
  <n-card
    content-style="padding: 8px 12px;"
    class="win-class"
    :class="{ 'defeat-class': !games.participants[0].stats.win }"
    :style="cardStyle"
    role="button"
    tabindex="0"
    @click="openDetail"
    @keyup.enter="openDetail"
  >
    <n-flex align="center" justify="space-between">
      <n-flex vertical style="gap: 1px">
        <span
          class="font-number"
          :style="{
            fontWeight: '700',
            fontSize: '14px',
            color: games.participants[0].stats.win ? themeColors.win : themeColors.loss,
            marginLeft: '4px',
            marginTop: '2px'
          }"
        >
          {{ games.participants[0].stats.win ? '胜利' : '失败' }}
          <n-divider style="margin: 1px 0; line-height: 1px" />
        </span>

        <span class="record-card-meta">
          <n-icon style="margin-right: 1px"><Time /></n-icon>
          {{ Math.ceil(games.gameDuration / 60) }}分
        </span>
      </n-flex>
      <div style="height: 42px; position: relative">
        <img
          style="height: 42px"
          :src="`${assetPrefix}/champion/${games.participants[0].championId}`"
        />
        <template v-if="!!games.mvp">
          <div
            style="position: absolute; left: 0; bottom: 0"
            class="mvp-box"
            :style="{ backgroundColor: games.mvp == 'MVP' ? '#FFD700' : '#FFFFFF' }"
          >
            {{ games.mvp == 'MVP' ? 'MVP' : 'SVP' }}
          </div>
        </template>
      </div>

      <n-flex vertical>
        <span class="font-number" style="font-size: 14px; font-weight: 700">{{
          games.queueName
        }}</span>
        <span class="record-card-meta">
          <n-icon style="margin-right: 1px"><CalendarNumber /></n-icon>
          {{ formattedDate }}
        </span>
      </n-flex>

      <n-flex justify="space-between" vertical style="gap: 0px">
        <n-flex justify="space-between">
          <span class="font-number">
            <span :style="{ fontWeight: '500', fontSize: '13px', color: themeColors.kill }">
              {{ games.participants[0].stats?.kills }}
            </span>
            /
            <span :style="{ fontWeight: '500', fontSize: '13px', color: themeColors.death }">
              {{ games.participants[0].stats?.deaths }}
            </span>
            /
            <span :style="{ fontWeight: '500', fontSize: '13px', color: themeColors.assist }">
              {{ games.participants[0].stats?.assists }}
            </span>
          </span>
          <span class="record-card-spell-icons">
            <img
              :src="spellSrc(games.participants[0].spell1Id)"
              class="record-card-icon-slot"
              alt="spell"
            />
            <img
              :src="spellSrc(games.participants[0].spell2Id)"
              class="record-card-icon-slot"
              alt="spell"
            />
          </span>
        </n-flex>
        <n-flex class="record-card-item-slots" style="gap: 2px">
          <n-tooltip
            v-for="(itemId, index) in itemIds(games.participants[0].stats)"
            :key="`record-item-${index}`"
            trigger="hover"
            placement="top"
            :disabled="!assetDetail(itemId)"
          >
            <template #trigger>
              <img :src="itemSrc(itemId)" class="record-card-icon-slot" alt="item" />
            </template>
            <AssetTooltipContent
              v-if="assetDetail(itemId)"
              :icon-src="itemSrc(itemId)"
              :name="assetDetail(itemId)?.name ?? ''"
              :description="assetDetail(itemId)?.description ?? ''"
            />
          </n-tooltip>
        </n-flex>
      </n-flex>
      <div class="record-card-stats-block">
        <StatDots
          :icon="FlameOutline"
          tooltip="对英雄伤害占比"
          :color="otherColor(games.participants[0].stats?.damageDealtToChampionsRate, isDark)"
          :icon-background="isDark ? 'rgba(229, 167, 50, 0.18)' : 'rgba(229, 167, 50, 0.14)'"
          :value="
            formatCompactNumber(games.participants[0].stats?.totalDamageDealtToChampions ?? 0)
          "
          :percent="games.participants[0].stats?.damageDealtToChampionsRate ?? 0"
        />
        <StatDots
          :icon="ShieldOutline"
          tooltip="承伤占比"
          :color="healColorAndTaken(games.participants[0].stats?.damageTakenRate, isDark)"
          :icon-background="isDark ? 'rgba(92, 163, 234, 0.2)' : 'rgba(92, 163, 234, 0.12)'"
          :value="formatCompactNumber(games.participants[0].stats?.totalDamageTaken ?? 0)"
          :percent="games.participants[0].stats?.damageTakenRate ?? 0"
        />
        <StatDots
          :icon="HeartOutline"
          tooltip="治疗占比"
          :color="healColorAndTaken(games.participants[0].stats?.healRate, isDark)"
          :icon-background="isDark ? 'rgba(88, 182, 109, 0.2)' : 'rgba(88, 182, 109, 0.14)'"
          :value="formatCompactNumber(games.participants[0].stats?.totalHeal ?? 0)"
          :percent="games.participants[0].stats?.healRate ?? 0"
        />
      </div>
      <n-flex vertical justify="space-between" style="gap: 0px">
        <n-tag :bordered="false" size="small">
          <template #avatar>
            <n-flex>
              <n-popover v-for="i in 5" :key="i" trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    @click.stop
                    @click="
                      toNameRecord(
                        games.gameDetail.participantIdentities[i - 1].player.gameName +
                          '#' +
                          games.gameDetail.participantIdentities[i - 1].player.tagLine
                      )
                    "
                  >
                    <n-avatar
                      :bordered="true"
                      :src="
                        assetPrefix +
                        '/champion/' +
                        games.gameDetail.participants[i - 1]?.championId
                      "
                      :fallback-src="itemNull"
                      :style="{
                        borderColor: getIsMeBorderedColor(
                          games.gameDetail.participantIdentities[i - 1]?.player.gameName +
                            '#' +
                            games.gameDetail.participantIdentities[i - 1]?.player.tagLine
                        )
                      }"
                    />
                  </n-button>
                </template>
                <span>{{
                  games.gameDetail.participantIdentities[i - 1].player.gameName +
                  '#' +
                  games.gameDetail.participantIdentities[i - 1].player.tagLine
                }}</span>
              </n-popover>
            </n-flex>
          </template>
        </n-tag>

        <n-tag :bordered="false" size="small">
          <template #avatar>
            <n-flex>
              <n-popover v-for="i in 5" :key="i + 5" trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    @click.stop
                    @click="
                      toNameRecord(
                        games.gameDetail.participantIdentities[i + 4]?.player.gameName +
                          '#' +
                          games.gameDetail.participantIdentities[i + 4]?.player.tagLine
                      )
                    "
                  >
                    <n-avatar
                      :bordered="true"
                      :src="
                        assetPrefix +
                        '/champion/' +
                        games.gameDetail.participants[i + 4]?.championId
                      "
                      :fallback-src="itemNull"
                      :style="{
                        borderColor: getIsMeBorderedColor(
                          games.gameDetail.participantIdentities[i + 4]?.player.gameName +
                            '#' +
                            games.gameDetail.participantIdentities[i + 4]?.player.tagLine
                        )
                      }"
                    />
                  </n-button>
                </template>
                <span>{{
                  games.gameDetail.participantIdentities[i + 4]?.player.gameName +
                  '#' +
                  games.gameDetail.participantIdentities[i + 4]?.player.tagLine
                }}</span>
              </n-popover>
            </n-flex>
          </template>
        </n-tag>
      </n-flex>
    </n-flex>
  </n-card>
</template>

<script lang="ts" setup>
import { Time, CalendarNumber, FlameOutline, ShieldOutline, HeartOutline } from '@vicons/ionicons5'
import itemNull from '../../assets/imgs/item/null.png'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatCompactNumber, healColorAndTaken, otherColor } from './composition'
import { assetPrefix } from '../../services/http'
import { useSettingsStore } from '../../pinia/setting'
import type { Game } from './match'
import type { ParticipantStats } from './match'
import AssetTooltipContent from './AssetTooltipContent.vue'
import { getAssetDetailsByIpc, type AssetDetail } from '../../services/ipc'
import StatDots from './StatDots.vue'

const settingsStore = useSettingsStore()
const isDark = computed(
  () => settingsStore.theme?.name === 'Dark' || settingsStore.theme?.name === 'dark'
)

/** 亮/暗两套主题色，默认情况也保证可见 */
const themeColors = computed(() => {
  if (isDark.value) {
    return {
      win: '#3d9b7a',
      loss: '#c45c5c',
      kill: '#3d9b7a',
      death: '#c45c5c',
      assist: '#b8860b'
    }
  }
  return {
    win: '#2d8a6c',
    loss: '#b84242',
    kill: '#2d8a6c',
    death: '#b84242',
    assist: '#b8860b'
  }
})

const cardStyle = computed(() => {
  const isWin = props.games.participants[0].stats.win
  const leftColor = isWin ? '#3d9b7a' : '#c45c5c'
  if (isDark.value) {
    return {
      borderLeft: `3px solid ${leftColor}`,
      boxShadow: 'var(--shadow-card)'
    }
  }
  return {
    backgroundColor: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--border-subtle)',
    borderLeft: `3px solid ${leftColor}`,
    borderRadius: 'var(--radius-md)'
  }
})

const router = useRouter()
// 接收 props
const props = defineProps<{
  recordType?: boolean // 确保这里是 boolean 类型
  games: Game
}>()

const emit = defineEmits<{
  'open-detail': []
}>()

const formattedDate = computed(() => {
  const date = new Date(props.games.gameCreationDate)
  // const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0') // 月份从0开始，所以加1
  const day = date.getDate().toString().padStart(2, '0') // 确保两位数格式
  return `${month}/${day}`
})

/** 己方高亮边框 / 其他玩家用主题可见边框，防止暗色下看不见 */
function getIsMeBorderedColor(name: string) {
  if (
    name ==
    props.games.participantIdentities[0].player.gameName +
      '#' +
      props.games.participantIdentities[0].player.tagLine
  ) {
    return isDark.value ? '#63e2b7' : '#0d9488'
  }
  return isDark.value ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'
}
function toNameRecord(name: string) {
  return router.push({
    path: '/Record',
    query: { name, t: Date.now() }
  }) // 添加动态时间戳作为查询参数
}

function spellSrc(spellId: number) {
  return spellId > 0 ? `${assetPrefix}/spell/${spellId}` : itemNull
}

function itemSrc(itemId: number) {
  return itemId > 0 ? `${assetPrefix}/item/${itemId}` : itemNull
}

function itemIds(stats: ParticipantStats) {
  return [stats.item0, stats.item1, stats.item2, stats.item3, stats.item4, stats.item5, stats.item6]
}

const itemDetails = ref<Record<number, AssetDetail>>({})

const itemIdsToLoad = computed(() => {
  const stats = props.games.participants[0].stats
  return [...new Set(itemIds(stats).filter(itemId => itemId > 0))]
})

watch(
  itemIdsToLoad,
  async ids => {
    if (!ids.length) {
      itemDetails.value = {}
      return
    }

    try {
      const details = await getAssetDetailsByIpc('item', ids)
      itemDetails.value = Object.fromEntries(details.map(detail => [detail.id, detail]))
    } catch (error) {
      console.error('failed to load record card item details', error)
      itemDetails.value = {}
    }
  },
  { immediate: true }
)

function assetDetail(itemId: number) {
  if (itemId <= 0) {
    return null
  }
  return itemDetails.value[itemId] ?? null
}

function openDetail() {
  emit('open-detail')
}
</script>

<style scoped>
/* 默认背景颜色，避免没有 recordType 时出现空白 */
.record-card {
  background: linear-gradient(120deg, rgb(133, 133, 133) 30%, rgba(44, 44, 44, 0.5));
}

.win-font {
  color: #03c2f7;
  font-weight: 300;
  font-size: small;
}

.responsive-img {
  width: auto;
  /* 保持宽高比 */
  object-fit: contain;
  /* 根据需求可以选择 contain, cover 等 */
}

.win-class {
  --n-border: 1px solid var(--semantic-win);
  --n-border-hover: 1px solid var(--semantic-win);
  --n-border-pressed: 1px solid var(--semantic-win);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-normal);
}

.win-class:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

.defeat-class {
  --n-border: 1px solid var(--semantic-loss);
  --n-border-hover: 1px solid var(--semantic-loss);
  --n-border-pressed: 1px solid var(--semantic-loss);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-normal);
}

.defeat-class:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

.bordered {
  border: red;
  /* 边框宽度2px，实线，红色 */
}

.win-class:hover {
  border: var(--n-border-hover);
}

.win-class:active {
  border: var(--n-border-pressed);
}

.win-class:focus {
  border: var(--n-border-focus);
}

.win-class:disabled {
  border: var(--n-border-disabled);
}

.mvp-box {
  display: inline-block;
  width: 20px;
  height: 11px;
  color: #000;
  font-weight: bold;
  font-size: 8px;
  line-height: 11px;
  text-align: center;
  border-radius: 3px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 伤害/承伤/治疗统计块 - 保留表格、缩小高度 */
.record-card-stats-block {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 8px 5px;
  background: rgba(0, 0, 0, 0.025);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  min-width: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.theme-light .record-card-stats-block {
  background: rgba(0, 0, 0, 0.02);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.record-card-meta {
  color: var(--text-secondary);
  font-size: 11px;
}

/* 装备格与技能图标统一圆角与边框 */
.record-card-item-slots :deep(.n-image),
.record-card-item-slots :deep(.n-image img),
.record-card-spell-icons .record-card-icon-slot {
  width: 23px;
  height: 23px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  box-sizing: border-box;
  object-fit: contain;
}

.record-card-item-slots .record-card-icon-slot {
  width: 23px;
  height: 23px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  box-sizing: border-box;
  object-fit: contain;
}

.record-card-spell-icons {
  display: inline-flex;
  gap: 2px;
}

/* 对局玩家头像网格精致化 */
:deep(.n-tag .n-avatar),
:deep(.n-button .n-avatar) {
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transition: box-shadow var(--transition-fast);
}
:deep(.n-tag .n-avatar:hover),
:deep(.n-button .n-avatar:hover) {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
}
</style>
