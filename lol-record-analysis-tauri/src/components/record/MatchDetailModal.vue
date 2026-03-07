<template>
  <div v-if="game && mySummary" class="match-detail-page">
    <div class="match-detail-modal">
      <div class="match-detail-shell">
        <div class="match-detail-header">
          <div>
            <div class="match-detail-title-row">
              <n-tag size="small" :bordered="false" :type="mySummary.win ? 'success' : 'error'">
                {{ mySummary.win ? '胜利' : '失败' }}
              </n-tag>
              <span class="match-detail-queue">{{ game.queueName }}</span>
              <span class="match-detail-meta">{{ formattedDate }} · {{ durationLabel }}</span>
            </div>
            <div class="match-detail-player-row">
              <img
                class="match-detail-hero"
                :src="assetPrefix + '/champion/' + mySummary.championId"
                alt="champion"
              />
              <div class="match-detail-player-copy">
                <div class="match-detail-player-name">{{ mySummary.displayName }}</div>
                <div class="match-detail-player-kda">
                  <span
                    class="font-number"
                    :style="{ color: killsColor(mySummary.stats.kills, isDark) }"
                    >{{ mySummary.stats.kills }}</span
                  >
                  <span>/</span>
                  <span
                    class="font-number"
                    :style="{ color: deathsColor(mySummary.stats.deaths, isDark) }"
                    >{{ mySummary.stats.deaths }}</span
                  >
                  <span>/</span>
                  <span
                    class="font-number"
                    :style="{ color: assistsColor(mySummary.stats.assists, isDark) }"
                    >{{ mySummary.stats.assists }}</span
                  >
                  <span
                    class="font-number match-detail-kda-ratio"
                    :style="{ color: kdaColor(kdaRatio(mySummary.stats), isDark) }"
                  >
                    {{ kdaRatioLabel(mySummary.stats) }}
                  </span>
                  <span class="match-detail-meta"
                    >{{ formatCompactNumber(mySummary.stats.goldEarned) }} 金币</span
                  >
                  <span class="match-detail-meta">{{ totalCs(mySummary.stats) }} 补兵</span>
                </div>
              </div>
            </div>
          </div>

          <div class="match-detail-summary-side">
            <div class="match-detail-summary-grid">
              <div class="match-detail-summary-card">
                <div class="match-detail-summary-label">输出</div>
                <div class="match-detail-summary-value font-number">
                  {{ formatCompactNumber(mySummary.stats.totalDamageDealtToChampions) }}
                </div>
              </div>
              <div class="match-detail-summary-card">
                <div class="match-detail-summary-label">承伤</div>
                <div class="match-detail-summary-value font-number">
                  {{ formatCompactNumber(mySummary.stats.totalDamageTaken) }}
                </div>
              </div>
              <div class="match-detail-summary-card">
                <div class="match-detail-summary-label">推塔</div>
                <div class="match-detail-summary-value font-number">
                  {{ formatCompactNumber(mySummary.stats.damageDealtToTurrets) }}
                </div>
              </div>
            </div>

            <div class="match-detail-ai-toolbar">
              <div class="match-detail-ai-copy">
                <span class="match-detail-ai-title">AI 复盘</span>
                <span class="match-detail-ai-subtitle">整局归因 + 单人责任分析</span>
              </div>
              <n-button
                size="small"
                secondary
                type="info"
                :loading="aiLoading"
                @click="handleOpenOverviewAnalysis"
              >
                <template #icon>
                  <n-icon><SparklesOutline /></n-icon>
                </template>
                整局分析
              </n-button>
            </div>
          </div>
        </div>

        <div class="match-detail-body">
          <section
            v-for="team in teamSections"
            :key="team.teamId"
            class="match-detail-team-section"
          >
            <div class="match-detail-team-header" :class="team.headerClass">
              <div class="match-detail-team-title-wrap">
                <span class="match-detail-team-title">{{ team.title }}</span>
                <span class="match-detail-team-subtitle">
                  {{ team.kills }}/{{ team.deaths }}/{{ team.assists }} ·
                  {{ formatCompactNumber(team.gold) }} 金币
                </span>
              </div>
              <div class="match-detail-team-subtitle">
                输出 {{ formatCompactNumber(team.damage) }} · 承伤
                {{ formatCompactNumber(team.taken) }}
              </div>
            </div>

            <div class="match-detail-column-header">
              <span>玩家</span>
              <span>装备 / 技能 / {{ usesAugments ? '海克斯' : '符文' }}</span>
              <span>KDA</span>
              <span>金钱</span>
              <span>补兵</span>
              <span>推塔</span>
              <span></span>
            </div>

            <div class="match-detail-team-rows">
              <div
                v-for="player in team.players"
                :key="player.participantId"
                class="match-detail-row"
                :class="{ 'match-detail-row-me': player.isMe }"
              >
                <div class="match-detail-player-cell">
                  <div class="match-detail-player-main">
                    <img
                      class="match-detail-player-avatar"
                      :src="assetPrefix + '/champion/' + player.championId"
                      alt="champion"
                    />
                    <div class="match-detail-player-text">
                      <div class="match-detail-player-text-row">
                        <span class="match-detail-player-display">{{ player.displayName }}</span>
                        <n-tag v-if="player.isMe" size="small" :bordered="false" type="info"
                          >我</n-tag
                        >
                        <n-button
                          quaternary
                          size="tiny"
                          class="match-detail-player-ai-trigger"
                          :loading="
                            aiLoading &&
                            aiMode === 'player' &&
                            aiTargetParticipantId === player.participantId
                          "
                          @click.stop="handleOpenPlayerAnalysis(player.participantId)"
                        >
                          <template #icon>
                            <n-icon><SparklesOutline /></n-icon>
                          </template>
                          分析
                        </n-button>
                      </div>
                      <div class="match-detail-badge-row">
                        <n-tooltip
                          v-for="badge in player.badges"
                          :key="badge.key"
                          trigger="hover"
                          placement="top"
                        >
                          <template #trigger>
                            <span class="match-detail-badge-icon" :class="badge.className">
                              <n-icon :size="10">
                                <component :is="badge.icon" />
                              </n-icon>
                            </span>
                          </template>
                          {{ badge.label }}
                        </n-tooltip>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="match-detail-build-cell">
                  <div class="match-detail-build-topline">
                    <div class="match-detail-spells">
                      <img
                        :src="spellSrc(player.spell1Id)"
                        class="match-detail-spell-icon"
                        alt="spell"
                      />
                      <img
                        :src="spellSrc(player.spell2Id)"
                        class="match-detail-spell-icon"
                        alt="spell"
                      />
                    </div>
                    <div class="match-detail-perks">
                      <n-tooltip
                        v-for="(perkId, index) in displayedPerkIds(player.stats)"
                        :key="`${player.participantId}-perk-${perkId}-${index}`"
                        trigger="hover"
                        placement="top"
                        :disabled="!assetDetail('perk', perkId)"
                      >
                        <template #trigger>
                          <span
                            v-if="usesAugments"
                            :class="['match-detail-augment-icon-shell', augmentRarityClass(perkId)]"
                          >
                            <img
                              :src="perkSrc(perkId)"
                              class="match-detail-augment-icon"
                              alt="augment"
                            />
                          </span>
                          <img
                            v-else
                            :src="perkSrc(perkId)"
                            :class="[
                              'match-detail-perk-icon',
                              { 'match-detail-perk-icon-sub': index === 1 }
                            ]"
                            alt="perk"
                          />
                        </template>
                        <AssetTooltipContent
                          v-if="assetDetail('perk', perkId)"
                          :icon-src="perkSrc(perkId)"
                          :name="assetDetail('perk', perkId)?.name ?? ''"
                          :description="assetDetail('perk', perkId)?.description ?? ''"
                        />
                      </n-tooltip>
                    </div>
                  </div>
                  <div class="match-detail-items">
                    <n-tooltip
                      v-for="(itemId, index) in itemIds(player.stats)"
                      :key="`${player.participantId}-${index}`"
                      trigger="hover"
                      placement="top"
                      :disabled="!assetDetail('item', itemId)"
                    >
                      <template #trigger>
                        <img :src="itemSrc(itemId)" class="match-detail-item-icon" alt="item" />
                      </template>
                      <AssetTooltipContent
                        v-if="assetDetail('item', itemId)"
                        :icon-src="itemSrc(itemId)"
                        :name="assetDetail('item', itemId)?.name ?? ''"
                        :description="assetDetail('item', itemId)?.description ?? ''"
                      />
                    </n-tooltip>
                  </div>
                </div>

                <div class="match-detail-value-cell font-number match-detail-kda-value-cell">
                  <span :style="{ color: killsColor(player.stats.kills, isDark) }">{{
                    player.stats.kills
                  }}</span>
                  <span class="match-detail-kda-separator">/</span>
                  <span :style="{ color: deathsColor(player.stats.deaths, isDark) }">{{
                    player.stats.deaths
                  }}</span>
                  <span class="match-detail-kda-separator">/</span>
                  <span :style="{ color: assistsColor(player.stats.assists, isDark) }">{{
                    player.stats.assists
                  }}</span>
                </div>
                <div class="match-detail-value-cell font-number">
                  {{ formatCompactNumber(player.stats.goldEarned) }}
                </div>
                <div class="match-detail-value-cell font-number">{{ totalCs(player.stats) }}</div>
                <div class="match-detail-value-cell font-number">
                  {{ formatCompactNumber(player.stats.damageDealtToTurrets) }}
                </div>

                <div class="match-detail-dots-cell">
                  <StatDots
                    :icon="FlameOutline"
                    tooltip="对英雄伤害，占己方总和百分比"
                    :color="otherColor(player.teamRelative.damage, isDark)"
                    :icon-background="
                      isDark ? 'rgba(229, 167, 50, 0.18)' : 'rgba(229, 167, 50, 0.14)'
                    "
                    :value="formatCompactNumber(player.stats.totalDamageDealtToChampions)"
                    :percent="player.teamRelative.damage"
                    compact
                  />
                  <StatDots
                    :icon="ShieldOutline"
                    tooltip="承受伤害，占己方总和百分比"
                    :color="healColorAndTaken(player.teamRelative.taken, isDark)"
                    :icon-background="
                      isDark ? 'rgba(92, 163, 234, 0.2)' : 'rgba(92, 163, 234, 0.12)'
                    "
                    :value="formatCompactNumber(player.stats.totalDamageTaken)"
                    :percent="player.teamRelative.taken"
                    compact
                  />
                  <StatDots
                    :icon="HeartOutline"
                    tooltip="治疗量，占己方总和百分比"
                    :color="healColorAndTaken(player.teamRelative.heal, isDark)"
                    :icon-background="
                      isDark ? 'rgba(88, 182, 109, 0.2)' : 'rgba(88, 182, 109, 0.14)'
                    "
                    :value="formatCompactNumber(player.stats.totalHeal)"
                    :percent="player.teamRelative.heal"
                    compact
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <n-modal v-model:show="showAiModal" preset="card" title="AI 复盘" style="width: 780px">
      <div class="match-detail-ai-modal-body">
        <div class="match-detail-ai-controls">
          <n-radio-group v-model:value="aiMode" size="small">
            <n-radio-button value="overview">整局总览</n-radio-button>
            <n-radio-button value="player">单人复盘</n-radio-button>
          </n-radio-group>

          <n-select
            v-if="aiMode === 'player'"
            v-model:value="aiTargetParticipantId"
            class="match-detail-ai-player-select"
            :options="aiPlayerOptions"
          />

          <n-button tertiary type="primary" :loading="aiLoading" @click="runCurrentAiAnalysis">
            重新分析
          </n-button>
        </div>

        <div v-if="aiResult" class="match-detail-ai-result" v-html="renderedAiResult"></div>
        <div v-else class="match-detail-ai-empty">选择分析类型后即可生成复盘结果。</div>
      </div>
    </n-modal>
  </div>
  <div v-else class="match-detail-empty-state">
    <span class="match-detail-empty-title">暂无对局详情</span>
    <span class="match-detail-empty-copy">回到战绩页重新打开一场对局即可。</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, type Component } from 'vue'
import {
  FlagOutline,
  CashOutline,
  FlameOutline,
  FootstepsOutline,
  HeartOutline,
  PeopleOutline,
  SparklesOutline,
  ShieldOutline,
  SkullOutline
} from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import MarkdownIt from 'markdown-it'
import { useSettingsStore } from '../../pinia/setting'
import { assetPrefix } from '../../services/http'
import itemNull from '../../assets/imgs/item/null.png'
import type { Game, ParticipantStats } from './match'
import { getAssetDetailsByIpc, type AssetDetail } from '../../services/ipc'
import AssetTooltipContent from './AssetTooltipContent.vue'
import StatDots from './StatDots.vue'
import {
  assistsColor,
  deathsColor,
  formatCompactNumber,
  healColorAndTaken,
  kdaColor,
  killsColor,
  otherColor,
  safeRelativePercent
} from './composition'
import { analyzeMatchDetailWithAI, type MatchDetailAnalysisMode } from '../../services/ai'

interface PlayerBadge {
  key: string
  label: string
  icon: Component
  className: string
}

interface DetailPlayer {
  participantId: number
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  stats: ParticipantStats
  displayName: string
  isMe: boolean
  win: boolean
  badges: PlayerBadge[]
  teamRelative: {
    damage: number
    taken: number
    heal: number
  }
}

const props = defineProps<{
  game: Game | null
}>()

const settingsStore = useSettingsStore()
const message = useMessage()
const isDark = computed(
  () => settingsStore.theme?.name === 'Dark' || settingsStore.theme?.name === 'dark'
)
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
})

const currentPlayerKey = computed(() => {
  const identity = props.game?.participantIdentities?.[0]?.player
  if (!identity) {
    return ''
  }
  return `${identity.gameName}#${identity.tagLine}`
})

function totalCs(stats: ParticipantStats) {
  return stats.totalMinionsKilled + stats.neutralMinionsKilled
}

function kdaRatio(stats: ParticipantStats) {
  return (stats.kills + stats.assists) / Math.max(1, stats.deaths)
}

function kdaRatioLabel(stats: ParticipantStats) {
  return `${kdaRatio(stats).toFixed(1)} KDA`
}

const detailPlayers = computed<DetailPlayer[]>(() => {
  if (!props.game) {
    return []
  }

  const participants = props.game.gameDetail?.participants?.length
    ? props.game.gameDetail.participants
    : props.game.participants
  const identities = props.game.gameDetail?.participantIdentities?.length
    ? props.game.gameDetail.participantIdentities
    : props.game.participantIdentities

  const teamTotals = new Map<number, { damage: number; taken: number; heal: number }>()

  for (const participant of participants) {
    const current = teamTotals.get(participant.teamId) ?? { damage: 0, taken: 0, heal: 0 }
    current.damage += participant.stats.totalDamageDealtToChampions
    current.taken += participant.stats.totalDamageTaken
    current.heal += participant.stats.totalHeal
    teamTotals.set(participant.teamId, current)
  }

  const markerConfigs = [
    {
      key: 'kills',
      label: '杀人最多',
      icon: SkullOutline,
      className: 'match-detail-badge-kills',
      value: (stats: ParticipantStats) => stats.kills
    },
    {
      key: 'assists',
      label: '助攻最多',
      icon: PeopleOutline,
      className: 'match-detail-badge-assists',
      value: (stats: ParticipantStats) => stats.assists
    },
    {
      key: 'turrets',
      label: '推塔最多',
      icon: FlagOutline,
      className: 'match-detail-badge-turrets',
      value: (stats: ParticipantStats) => stats.damageDealtToTurrets
    },
    {
      key: 'gold',
      label: '钱最多',
      icon: CashOutline,
      className: 'match-detail-badge-gold',
      value: (stats: ParticipantStats) => stats.goldEarned
    },
    {
      key: 'taken',
      label: '承伤最多',
      icon: ShieldOutline,
      className: 'match-detail-badge-taken',
      value: (stats: ParticipantStats) => stats.totalDamageTaken
    },
    {
      key: 'cs',
      label: '补兵最多',
      icon: FootstepsOutline,
      className: 'match-detail-badge-cs',
      value: (stats: ParticipantStats) => totalCs(stats)
    }
  ]

  const markerWinners = new Map<string, Set<number>>()

  for (const config of markerConfigs) {
    const maxValue = participants.reduce((max, participant) => {
      return Math.max(max, config.value(participant.stats))
    }, 0)

    if (maxValue <= 0) {
      continue
    }

    markerWinners.set(
      config.label,
      new Set(
        participants
          .filter(participant => config.value(participant.stats) === maxValue)
          .map(participant => participant.participantId)
      )
    )
  }

  return [...participants]
    .sort((left, right) => left.participantId - right.participantId)
    .map((participant, index) => {
      const identity = identities[participant.participantId - 1] ?? identities[index]
      const displayName = identity
        ? `${identity.player.gameName}#${identity.player.tagLine}`
        : `玩家${participant.participantId}`
      const totalValues = teamTotals.get(participant.teamId) ?? { damage: 0, taken: 0, heal: 0 }

      return {
        participantId: participant.participantId,
        teamId: participant.teamId,
        championId: participant.championId,
        spell1Id: participant.spell1Id,
        spell2Id: participant.spell2Id,
        stats: participant.stats,
        displayName,
        isMe: displayName === currentPlayerKey.value,
        win: participant.stats.win,
        badges: markerConfigs
          .filter(config => markerWinners.get(config.label)?.has(participant.participantId))
          .map(config => ({
            key: config.key,
            label: config.label,
            icon: config.icon,
            className: config.className
          })),
        teamRelative: {
          damage: safeRelativePercent(
            participant.stats.totalDamageDealtToChampions,
            totalValues.damage
          ),
          taken: safeRelativePercent(participant.stats.totalDamageTaken, totalValues.taken),
          heal: safeRelativePercent(participant.stats.totalHeal, totalValues.heal)
        }
      }
    })
})

const mySummary = computed(
  () => detailPlayers.value.find(player => player.isMe) ?? detailPlayers.value[0]
)

const teamSections = computed(() => {
  const teamMap = new Map<number, DetailPlayer[]>()
  for (const player of detailPlayers.value) {
    const current = teamMap.get(player.teamId) ?? []
    current.push(player)
    teamMap.set(player.teamId, current)
  }

  return [...teamMap.entries()]
    .map(([teamId, players]) => {
      const totals = players.reduce(
        (acc, player) => {
          acc.kills += player.stats.kills
          acc.deaths += player.stats.deaths
          acc.assists += player.stats.assists
          acc.gold += player.stats.goldEarned
          acc.damage += player.stats.totalDamageDealtToChampions
          acc.taken += player.stats.totalDamageTaken
          return acc
        },
        { kills: 0, deaths: 0, assists: 0, gold: 0, damage: 0, taken: 0 }
      )
      const won = players[0]?.win ?? false

      return {
        teamId,
        players,
        title: won ? '胜方' : '败方',
        headerClass: won ? 'match-detail-team-header-win' : 'match-detail-team-header-loss',
        ...totals
      }
    })
    .sort(
      (left, right) =>
        Number(right.players[0]?.win ?? false) - Number(left.players[0]?.win ?? false)
    )
})

const formattedDate = computed(() => {
  if (!props.game) {
    return ''
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(props.game.gameCreationDate))
})

const durationLabel = computed(() => {
  if (!props.game) {
    return ''
  }
  const minutes = Math.floor(props.game.gameDuration / 60)
  const seconds = props.game.gameDuration % 60
  return `${minutes}分${seconds.toString().padStart(2, '0')}秒`
})

const augmentQueueIds = new Set([1700, 2400])
const usesAugments = computed(() => {
  if (!props.game || !augmentQueueIds.has(props.game.queueId)) {
    return false
  }

  return detailPlayers.value.some(player => playerAugmentIds(player.stats).length > 0)
})

const assetDetails = ref<Record<string, AssetDetail>>({})
const showAiModal = ref(false)
const aiLoading = ref(false)
const aiResult = ref('')
const aiMode = ref<MatchDetailAnalysisMode>('overview')
const aiTargetParticipantId = ref<number | null>(null)

const renderedAiResult = computed(() => {
  if (!aiResult.value) {
    return ''
  }

  return md.render(aiResult.value)
})

const aiPlayerOptions = computed(() =>
  detailPlayers.value.map(player => ({
    label: player.displayName,
    value: player.participantId
  }))
)

const assetIds = computed(() => {
  const itemIdsToLoad = new Set<number>()
  const perkIdsToLoad = new Set<number>()

  for (const player of detailPlayers.value) {
    for (const itemId of itemIds(player.stats)) {
      if (itemId > 0) {
        itemIdsToLoad.add(itemId)
      }
    }

    for (const perkId of displayedPerkIds(player.stats)) {
      perkIdsToLoad.add(perkId)
    }
  }

  return {
    itemIds: [...itemIdsToLoad],
    perkIds: [...perkIdsToLoad]
  }
})

watch(
  assetIds,
  async ({ itemIds, perkIds }) => {
    if (!props.game) {
      assetDetails.value = {}
      return
    }

    try {
      const [items, perks] = await Promise.all([
        itemIds.length ? getAssetDetailsByIpc('item', itemIds) : Promise.resolve([]),
        perkIds.length ? getAssetDetailsByIpc('perk', perkIds) : Promise.resolve([])
      ])

      const nextDetails: Record<string, AssetDetail> = {}
      for (const item of items) {
        nextDetails[assetDetailKey('item', item.id)] = item
      }
      for (const perk of perks) {
        nextDetails[assetDetailKey('perk', perk.id)] = perk
      }
      assetDetails.value = nextDetails
    } catch (error) {
      console.error('failed to load asset details', error)
      assetDetails.value = {}
    }
  },
  { immediate: true }
)

function itemIds(stats: ParticipantStats) {
  return [stats.item0, stats.item1, stats.item2, stats.item3, stats.item4, stats.item5, stats.item6]
}

function itemSrc(itemId: number) {
  return itemId > 0 ? `${assetPrefix}/item/${itemId}` : itemNull
}

function spellSrc(spellId: number) {
  return spellId > 0 ? `${assetPrefix}/spell/${spellId}` : itemNull
}

function perkSrc(perkId: number) {
  return perkId > 0 ? `${assetPrefix}/perk/${perkId}` : itemNull
}

function augmentRarity(perkId: number) {
  return assetDetail('perk', perkId)?.rarity ?? ''
}

function augmentRarityClass(perkId: number) {
  switch (augmentRarity(perkId)) {
    case 'kPrismatic':
      return 'match-detail-augment-prismatic'
    case 'kGold':
      return 'match-detail-augment-gold'
    case 'kSilver':
      return 'match-detail-augment-silver'
    case 'kBronze':
      return 'match-detail-augment-bronze'
    default:
      return 'match-detail-augment-default'
  }
}

function playerAugmentIds(stats: ParticipantStats) {
  return [
    stats.playerAugment1,
    stats.playerAugment2,
    stats.playerAugment3,
    stats.playerAugment4
  ].filter(perkId => perkId > 0)
}

function displayedPerkIds(stats: ParticipantStats) {
  if (usesAugments.value) {
    const augmentIds = playerAugmentIds(stats)
    if (augmentIds.length > 0) {
      return augmentIds
    }
  }

  return [stats.perk0, stats.perkSubStyle].filter(perkId => perkId > 0)
}

function assetDetailKey(type: 'item' | 'perk', id: number) {
  return `${type}:${id}`
}

function assetDetail(type: 'item' | 'perk', id: number) {
  if (id <= 0) {
    return null
  }
  return assetDetails.value[assetDetailKey(type, id)] ?? null
}

watch(
  [aiMode, aiTargetParticipantId],
  ([mode, participantId], [previousMode, previousParticipantId]) => {
    if (!showAiModal.value || !props.game) {
      return
    }

    if (mode === previousMode && participantId === previousParticipantId) {
      return
    }

    void runCurrentAiAnalysis()
  }
)

watch(
  () => props.game?.gameId,
  () => {
    aiResult.value = ''
    aiMode.value = 'overview'
    aiTargetParticipantId.value =
      mySummary.value?.participantId ?? detailPlayers.value[0]?.participantId ?? null
  },
  { immediate: true }
)

async function handleOpenOverviewAnalysis() {
  aiMode.value = 'overview'
  aiTargetParticipantId.value =
    mySummary.value?.participantId ?? detailPlayers.value[0]?.participantId ?? null
  showAiModal.value = true
  await runCurrentAiAnalysis()
}

async function handleOpenPlayerAnalysis(participantId: number) {
  aiMode.value = 'player'
  aiTargetParticipantId.value = participantId
  showAiModal.value = true
  await runCurrentAiAnalysis()
}

async function runCurrentAiAnalysis() {
  if (!props.game || aiLoading.value) {
    return
  }

  if (aiMode.value === 'player' && !aiTargetParticipantId.value) {
    message.warning('请选择要分析的玩家')
    return
  }

  aiLoading.value = true
  try {
    const result = await analyzeMatchDetailWithAI(props.game, {
      mode: aiMode.value,
      participantId:
        aiMode.value === 'player' ? (aiTargetParticipantId.value ?? undefined) : undefined
    })

    if (result.success && result.content) {
      aiResult.value = result.content
      return
    }

    message.error(result.error || 'AI 分析失败')
  } catch (error: any) {
    message.error('AI 分析出错: ' + (error.message || '未知错误'))
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.match-detail-page {
  width: 100%;
  height: 100%;
  padding: 2px 3px 3px;
  box-sizing: border-box;
  background: var(--bg-base);
}

.match-detail-modal {
  width: 100%;
  height: 100%;
  max-height: none;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-sizing: border-box;
  color: var(--text-primary);
  background:
    radial-gradient(circle at top left, rgba(61, 155, 122, 0.14), transparent 28%),
    radial-gradient(circle at top right, rgba(92, 163, 234, 0.16), transparent 32%), var(--bg-base);
}

.match-detail-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.match-detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 6px;
  padding: 7px 10px 5px;
  border-bottom: 1px solid var(--border-subtle);
}

.match-detail-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}

.match-detail-queue {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-meta {
  color: var(--text-secondary);
  font-size: 11px;
}

.match-detail-player-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.match-detail-hero {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
}

.match-detail-player-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.match-detail-player-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-player-kda {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-primary);
}

.match-detail-kda-ratio {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 600;
}

.match-detail-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.match-detail-summary-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.match-detail-summary-card {
  padding: 5px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
}

.theme-light .match-detail-summary-card {
  background: rgba(255, 255, 255, 0.82);
}

.match-detail-summary-label {
  color: var(--text-secondary);
  font-size: 10px;
  margin-bottom: 4px;
}

.match-detail-summary-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-ai-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
}

.theme-light .match-detail-ai-toolbar {
  background: rgba(255, 255, 255, 0.82);
}

.match-detail-ai-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.match-detail-ai-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-ai-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.match-detail-body {
  overflow: auto;
  padding: 4px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.match-detail-team-section {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);
}

.theme-light .match-detail-team-section {
  background: rgba(255, 255, 255, 0.92);
}

.match-detail-team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  color: #fff;
}

.match-detail-team-header-win {
  background: linear-gradient(90deg, rgba(45, 138, 108, 0.88), rgba(45, 138, 108, 0.52));
}

.match-detail-team-header-loss {
  background: linear-gradient(90deg, rgba(184, 66, 66, 0.88), rgba(184, 66, 66, 0.52));
}

.match-detail-team-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.match-detail-team-title {
  font-size: 14px;
  font-weight: 700;
}

.match-detail-team-subtitle {
  font-size: 11px;
  opacity: 0.95;
}

.match-detail-column-header,
.match-detail-row {
  display: grid;
  grid-template-columns: minmax(188px, 1.22fr) minmax(214px, 1.36fr) 72px 68px 62px 68px minmax(
      198px,
      1.3fr
    );
  gap: 6px;
  align-items: center;
}

.match-detail-column-header {
  padding: 4px 9px;
  color: var(--text-secondary);
  font-size: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border-subtle);
}

.theme-light .match-detail-column-header {
  background: rgba(0, 0, 0, 0.02);
}

.match-detail-team-rows {
  display: flex;
  flex-direction: column;
}

.match-detail-row {
  padding: 4px 9px;
  border-bottom: 1px solid var(--border-subtle);
}

.match-detail-row:last-child {
  border-bottom: none;
}

.match-detail-row-me {
  background: rgba(92, 163, 234, 0.08);
}

.theme-light .match-detail-row-me {
  background: rgba(92, 163, 234, 0.06);
}

.match-detail-player-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.match-detail-player-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.match-detail-player-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.match-detail-player-text-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.match-detail-player-display {
  font-weight: 600;
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-detail-player-ai-trigger {
  --n-text-color: var(--text-secondary);
}

.match-detail-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.match-detail-player-text-row :deep(.n-tag) {
  color: var(--text-primary);
}

.match-detail-badge-icon {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.match-detail-badge-kills {
  color: #f2bf63;
  background: rgba(242, 191, 99, 0.14);
}

.match-detail-badge-assists {
  color: #63d8b4;
  background: rgba(99, 216, 180, 0.14);
}

.match-detail-badge-turrets {
  color: #59b5ff;
  background: rgba(89, 181, 255, 0.14);
}

.match-detail-badge-gold {
  color: #f7d35f;
  background: rgba(247, 211, 95, 0.14);
}

.match-detail-badge-taken {
  color: #ef7d7d;
  background: rgba(239, 125, 125, 0.14);
}

.match-detail-badge-cs {
  color: #7eb8ff;
  background: rgba(126, 184, 255, 0.14);
}

.match-detail-build-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.match-detail-build-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.match-detail-spells {
  display: flex;
  gap: 2px;
}

.match-detail-spell-icon,
.match-detail-item-icon,
.match-detail-perk-icon {
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  object-fit: cover;
}

.match-detail-perks {
  display: flex;
  align-items: center;
  gap: 2px;
}

.match-detail-augment-icon-shell {
  --augment-border: rgba(172, 185, 201, 0.42);
  --augment-background: linear-gradient(180deg, rgba(56, 65, 78, 0.92), rgba(27, 32, 41, 0.96));
  --augment-filter: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1px solid var(--augment-border);
  background: var(--augment-background);
  box-sizing: border-box;
  overflow: hidden;
}

.match-detail-augment-icon {
  width: 12px;
  height: 12px;
  object-fit: contain;
  filter: var(--augment-filter);
}

.match-detail-augment-prismatic {
  --augment-border: rgba(187, 125, 255, 0.92);
  --augment-background: linear-gradient(180deg, rgba(123, 82, 214, 0.9), rgba(55, 34, 110, 0.98));
  --augment-filter: brightness(0) saturate(100%) invert(79%) sepia(31%) saturate(2173%)
    hue-rotate(225deg) brightness(102%) contrast(101%);
}

.match-detail-augment-gold {
  --augment-border: rgba(244, 198, 88, 0.92);
  --augment-background: linear-gradient(180deg, rgba(121, 90, 18, 0.9), rgba(62, 46, 8, 0.98));
  --augment-filter: brightness(0) saturate(100%) invert(82%) sepia(51%) saturate(590%)
    hue-rotate(354deg) brightness(103%) contrast(104%);
}

.match-detail-augment-silver {
  --augment-border: rgba(191, 205, 227, 0.88);
  --augment-background: linear-gradient(180deg, rgba(86, 103, 126, 0.9), rgba(39, 48, 61, 0.98));
  --augment-filter: brightness(0) saturate(100%) invert(93%) sepia(10%) saturate(418%)
    hue-rotate(176deg) brightness(103%) contrast(99%);
}

.match-detail-augment-bronze {
  --augment-border: rgba(197, 132, 89, 0.9);
  --augment-background: linear-gradient(180deg, rgba(118, 67, 35, 0.9), rgba(59, 33, 17, 0.98));
  --augment-filter: brightness(0) saturate(100%) invert(76%) sepia(31%) saturate(740%)
    hue-rotate(338deg) brightness(98%) contrast(94%);
}

.match-detail-augment-default {
  --augment-border: rgba(172, 185, 201, 0.42);
  --augment-background: linear-gradient(180deg, rgba(56, 65, 78, 0.92), rgba(27, 32, 41, 0.96));
  --augment-filter: none;
}

.match-detail-perk-icon-sub {
  opacity: 0.88;
}

.match-detail-items {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.match-detail-value-cell {
  font-weight: 600;
  font-size: 11px;
  color: var(--text-primary);
}

.match-detail-kda-value-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.match-detail-kda-separator {
  color: var(--text-tertiary);
}

.match-detail-dots-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.match-detail-ai-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-detail-ai-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.match-detail-ai-player-select {
  min-width: 240px;
}

.match-detail-ai-result {
  max-height: 70vh;
  overflow-y: auto;
  padding: 8px 4px;
  line-height: 1.8;
  font-size: 14px;
}

.match-detail-ai-result :deep(h2) {
  margin: 16px 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-ai-result :deep(ul) {
  padding-left: 20px;
}

.match-detail-ai-result :deep(li) {
  margin: 6px 0;
}

.match-detail-ai-result :deep(p) {
  margin: 8px 0;
}

.match-detail-ai-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-secondary);
}

.match-detail-empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  background: var(--bg-base);
}

.match-detail-empty-title {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
}

.match-detail-empty-copy {
  font-size: 12px;
}

@media (max-width: 1100px) {
  .match-detail-header {
    grid-template-columns: 1fr;
  }

  .match-detail-ai-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .match-detail-column-header,
  .match-detail-row {
    grid-template-columns: 1fr;
  }

  .match-detail-column-header {
    display: none;
  }

  .match-detail-row {
    gap: 10px;
  }

  .match-detail-ai-controls {
    flex-wrap: wrap;
  }
}
</style>
