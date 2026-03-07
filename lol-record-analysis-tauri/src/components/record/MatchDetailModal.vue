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
                  <span class="font-number" :style="{ color: killsColor(mySummary.stats.kills, isDark) }">{{ mySummary.stats.kills }}</span>
                  <span>/</span>
                  <span class="font-number" :style="{ color: deathsColor(mySummary.stats.deaths, isDark) }">{{ mySummary.stats.deaths }}</span>
                  <span>/</span>
                  <span class="font-number" :style="{ color: assistsColor(mySummary.stats.assists, isDark) }">{{ mySummary.stats.assists }}</span>
                  <span
                    class="font-number match-detail-kda-ratio"
                    :style="{ color: kdaColor(kdaRatio(mySummary.stats), isDark) }"
                  >
                    {{ kdaRatioLabel(mySummary.stats) }}
                  </span>
                  <span class="match-detail-meta">{{ formatCompactNumber(mySummary.stats.goldEarned) }} 金币</span>
                  <span class="match-detail-meta">{{ totalCs(mySummary.stats) }} 补兵</span>
                </div>
              </div>
            </div>
          </div>

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
        </div>

        <div class="match-detail-body">
          <section v-for="team in teamSections" :key="team.teamId" class="match-detail-team-section">
            <div class="match-detail-team-header" :class="team.headerClass">
              <div class="match-detail-team-title-wrap">
                <span class="match-detail-team-title">{{ team.title }}</span>
                <span class="match-detail-team-subtitle">
                  {{ team.kills }}/{{ team.deaths }}/{{ team.assists }} · {{ formatCompactNumber(team.gold) }} 金币
                </span>
              </div>
              <div class="match-detail-team-subtitle">
                输出 {{ formatCompactNumber(team.damage) }} · 承伤 {{ formatCompactNumber(team.taken) }}
              </div>
            </div>

            <div class="match-detail-column-header">
              <span>玩家</span>
              <span>装备 / 技能 / 符文</span>
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
                        <n-tag v-if="player.isMe" size="small" :bordered="false" type="info">我</n-tag>
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
                      <img :src="spellSrc(player.spell1Id)" class="match-detail-spell-icon" alt="spell" />
                      <img :src="spellSrc(player.spell2Id)" class="match-detail-spell-icon" alt="spell" />
                    </div>
                    <div class="match-detail-perks">
                      <n-tooltip
                        trigger="hover"
                        placement="top"
                        :disabled="!assetDetail('perk', player.stats.perk0)"
                      >
                        <template #trigger>
                          <img
                            :src="perkSrc(player.stats.perk0)"
                            class="match-detail-perk-icon"
                            alt="primary perk"
                          />
                        </template>
                        <AssetTooltipContent
                          v-if="assetDetail('perk', player.stats.perk0)"
                          :icon-src="perkSrc(player.stats.perk0)"
                          :name="assetDetail('perk', player.stats.perk0)?.name ?? ''"
                          :description="assetDetail('perk', player.stats.perk0)?.description ?? ''"
                        />
                      </n-tooltip>
                      <n-tooltip
                        trigger="hover"
                        placement="top"
                        :disabled="!assetDetail('perk', player.stats.perkSubStyle)"
                      >
                        <template #trigger>
                          <img
                            :src="perkSrc(player.stats.perkSubStyle)"
                            class="match-detail-perk-icon match-detail-perk-icon-sub"
                            alt="sub perk"
                          />
                        </template>
                        <AssetTooltipContent
                          v-if="assetDetail('perk', player.stats.perkSubStyle)"
                          :icon-src="perkSrc(player.stats.perkSubStyle)"
                          :name="assetDetail('perk', player.stats.perkSubStyle)?.name ?? ''"
                          :description="assetDetail('perk', player.stats.perkSubStyle)?.description ?? ''"
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
                        <img
                          :src="itemSrc(itemId)"
                          class="match-detail-item-icon"
                          alt="item"
                        />
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
                  <span :style="{ color: killsColor(player.stats.kills, isDark) }">{{ player.stats.kills }}</span>
                  <span class="match-detail-kda-separator">/</span>
                  <span :style="{ color: deathsColor(player.stats.deaths, isDark) }">{{ player.stats.deaths }}</span>
                  <span class="match-detail-kda-separator">/</span>
                  <span :style="{ color: assistsColor(player.stats.assists, isDark) }">{{ player.stats.assists }}</span>
                </div>
                <div class="match-detail-value-cell font-number">{{ formatCompactNumber(player.stats.goldEarned) }}</div>
                <div class="match-detail-value-cell font-number">{{ totalCs(player.stats) }}</div>
                <div class="match-detail-value-cell font-number">{{ formatCompactNumber(player.stats.damageDealtToTurrets) }}</div>

                <div class="match-detail-dots-cell">
                  <StatDots
                    :icon="FlameOutline"
                    tooltip="对英雄伤害，占己方总和百分比"
                    :color="otherColor(player.teamRelative.damage, isDark)"
                    :icon-background="isDark ? 'rgba(229, 167, 50, 0.18)' : 'rgba(229, 167, 50, 0.14)'"
                    :value="formatCompactNumber(player.stats.totalDamageDealtToChampions)"
                    :percent="player.teamRelative.damage"
                    compact
                  />
                  <StatDots
                    :icon="ShieldOutline"
                    tooltip="承受伤害，占己方总和百分比"
                    :color="healColorAndTaken(player.teamRelative.taken, isDark)"
                    :icon-background="isDark ? 'rgba(92, 163, 234, 0.2)' : 'rgba(92, 163, 234, 0.12)'"
                    :value="formatCompactNumber(player.stats.totalDamageTaken)"
                    :percent="player.teamRelative.taken"
                    compact
                  />
                  <StatDots
                    :icon="HeartOutline"
                    tooltip="治疗量，占己方总和百分比"
                    :color="healColorAndTaken(player.teamRelative.heal, isDark)"
                    :icon-background="isDark ? 'rgba(88, 182, 109, 0.2)' : 'rgba(88, 182, 109, 0.14)'"
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
  ShieldOutline,
  SkullOutline
} from '@vicons/ionicons5'
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
const isDark = computed(
  () => settingsStore.theme?.name === 'Dark' || settingsStore.theme?.name === 'dark'
)

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

const mySummary = computed(() => detailPlayers.value.find(player => player.isMe) ?? detailPlayers.value[0])

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
    .sort((left, right) => Number(right.players[0]?.win ?? false) - Number(left.players[0]?.win ?? false))
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

const assetDetails = ref<Record<string, AssetDetail>>({})

const assetIds = computed(() => {
  const itemIdsToLoad = new Set<number>()
  const perkIdsToLoad = new Set<number>()

  for (const player of detailPlayers.value) {
    for (const itemId of itemIds(player.stats)) {
      if (itemId > 0) {
        itemIdsToLoad.add(itemId)
      }
    }

    if (player.stats.perk0 > 0) {
      perkIdsToLoad.add(player.stats.perk0)
    }
    if (player.stats.perkSubStyle > 0) {
      perkIdsToLoad.add(player.stats.perkSubStyle)
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

function assetDetailKey(type: 'item' | 'perk', id: number) {
  return `${type}:${id}`
}

function assetDetail(type: 'item' | 'perk', id: number) {
  if (id <= 0) {
    return null
  }
  return assetDetails.value[assetDetailKey(type, id)] ?? null
}
</script>

<style scoped>
.match-detail-page {
  width: 100%;
  height: 100%;
  padding: 2px 4px 4px;
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
    radial-gradient(circle at top right, rgba(92, 163, 234, 0.16), transparent 32%),
    var(--bg-base);
}

.match-detail-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.match-detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 8px;
  padding: 8px 12px 6px;
  border-bottom: 1px solid var(--border-subtle);
}

.match-detail-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
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
  gap: 8px;
}

.match-detail-hero {
  width: 42px;
  height: 42px;
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
  gap: 6px;
}

.match-detail-summary-card {
  padding: 6px 8px;
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
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.match-detail-body {
  overflow: auto;
  padding: 4px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  gap: 8px;
  padding: 6px 10px;
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
  grid-template-columns: minmax(200px, 1.25fr) minmax(230px, 1.45fr) 76px 74px 66px 74px minmax(215px, 1.45fr);
  gap: 8px;
  align-items: center;
}

.match-detail-column-header {
  padding: 5px 10px;
  color: var(--text-secondary);
  font-size: 11px;
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
  padding: 5px 10px;
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
  gap: 7px;
}

.match-detail-player-avatar {
  width: 32px;
  height: 32px;
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
  gap: 6px;
}

.match-detail-player-display {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: 4px;
}

.match-detail-build-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.match-detail-spells {
  display: flex;
  gap: 3px;
}

.match-detail-spell-icon,
.match-detail-item-icon,
.match-detail-perk-icon {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  object-fit: cover;
}

.match-detail-perks {
  display: flex;
  align-items: center;
  gap: 3px;
}

.match-detail-perk-icon-sub {
  opacity: 0.88;
}

.match-detail-items {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.match-detail-value-cell {
  font-weight: 600;
  font-size: 12px;
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
  gap: 3px;
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
}
</style>