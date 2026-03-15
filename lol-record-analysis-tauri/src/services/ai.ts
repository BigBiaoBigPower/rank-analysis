import type {
  Game,
  MatchPlayerIdentity,
  Participant,
  ParticipantStats
} from '../components/record/match'

const AI_PROXY_URL = 'https://ai.nuliyangguang.top'
const DEFAULT_SYSTEM_PROMPT =
  '你是一个LOL游戏分析师，擅长分析玩家战绩和给出游戏建议。请用简洁、专业、直接的中文回复。所有结论都必须绑定数据证据，避免空泛。'

export type MatchDetailAnalysisMode = 'overview' | 'player'

export interface MatchDetailAnalysisOptions {
  mode?: MatchDetailAnalysisMode
  participantId?: number
}

export interface AIAnalysisResult {
  success: boolean
  content?: string
  error?: string
}

// 英雄 ID 到中文名映射（动态加载）
let championNameMap: Record<number, string> = {}

// 加载英雄名称映射
async function loadChampionNames(): Promise<void> {
  if (Object.keys(championNameMap).length > 0) return // 已加载

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const champions = await invoke<Array<{ value: number; label: string }>>('get_champion_options')

    championNameMap = {}
    champions.forEach(champ => {
      championNameMap[champ.value] = champ.label
    })
  } catch (e) {
    console.error('Failed to load champion names:', e)
  }
}

function getChampionName(id: number): string {
  return championNameMap[id] || `英雄${id}`
}

async function requestAIContent(
  prompt: string,
  cacheKey: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<AIAnalysisResult> {
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    return {
      success: true,
      content: cached
    }
  }

  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (data.choices && data.choices[0]?.message?.content) {
    const content = data.choices[0].message.content
    sessionStorage.setItem(cacheKey, content)

    return {
      success: true,
      content
    }
  }

  if (data.error) {
    return {
      success: false,
      error: data.error.message || 'AI 分析失败'
    }
  }

  return {
    success: false,
    error: '未知错误'
  }
}

/**
 * 调用 AI 分析战绩
 * @param gameData 战绩数据
 * @param type 分析类型：'team' | 'player'
 */
export async function analyzeGameWithAI(
  gameData: any,
  type: 'team' | 'player' = 'team'
): Promise<AIAnalysisResult> {
  try {
    // 先加载英雄名称映射
    await loadChampionNames()

    const prompt = buildAnalysisPrompt(gameData, type)
    const cacheKey = `ai_${type}_${JSON.stringify(prompt)}`
    return await requestAIContent(
      prompt,
      cacheKey,
      '你是一个LOL游戏分析师，擅长分析玩家战绩和给出游戏建议。请用简洁的中文回复，不要太长。'
    )
  } catch (error: any) {
    console.error('AI analysis error:', error)
    return {
      success: false,
      error: error.message || '网络请求失败'
    }
  }
}

/**
 * 构建分析提示词
 */
function buildAnalysisPrompt(gameData: any, type: 'team' | 'player'): string {
  if (type === 'team') {
    return buildTeamAnalysisPrompt(gameData)
  } else {
    return buildPlayerAnalysisPrompt(gameData)
  }
}

/**
 * 构建队伍分析提示词
 */
function buildTeamAnalysisPrompt(sessionData: any): string {
  // 提取我方队伍详细信息
  const teamOneInfo = sessionData.teamOne?.map((p: any) => {
    const recentGames = p.matchHistory?.games?.games || []
    const tags = p.userTag?.tag || []

    // 统计英雄出场次数
    const championStats: Record<
      number,
      { count: number; wins: number; totalKda: number; totalDamage: number }
    > = {}
    recentGames.forEach((g: any) => {
      const champId = g.participants[0]?.championId
      if (!champId) return
      if (!championStats[champId]) {
        championStats[champId] = { count: 0, wins: 0, totalKda: 0, totalDamage: 0 }
      }
      championStats[champId].count++
      if (g.participants[0].stats.win) championStats[champId].wins++
      const kda =
        (g.participants[0].stats.kills + g.participants[0].stats.assists) /
        Math.max(g.participants[0].stats.deaths, 1)
      championStats[champId].totalKda += kda
      championStats[champId].totalDamage += g.participants[0].stats.totalDamageDealtToChampions || 0
    })

    // 计算平均KDA和伤害
    Object.keys(championStats).forEach(key => {
      const champ = championStats[Number(key)]
      champ.totalKda /= champ.count
      champ.totalDamage /= champ.count
    })

    // 找出最常玩的英雄（前5个）
    const topChampions = Object.entries(championStats)
      .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
      .slice(0, 5)
      .map(([champId, stats]) => ({
        champion: getChampionName(Number(champId)),
        games: (stats as any).count,
        winRate: Math.round(((stats as any).wins / (stats as any).count) * 100),
        avgKda: (stats as any).totalKda.toFixed(2),
        avgDamage: Math.round((stats as any).totalDamage)
      }))

    // 位置分析
    const positionStats: Record<string, number> = {}
    recentGames.forEach((g: any) => {
      const pos =
        g.participants[0]?.timeline?.lane || g.participants[0]?.selectedPosition || 'UNKNOWN'
      positionStats[pos] = (positionStats[pos] || 0) + 1
    })

    const mainPosition = Object.entries(positionStats).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知'

    return {
      name: p.summoner?.gameName || '未知',
      currentChampion: getChampionName(p.championId),
      tier: p.rank?.queueMap?.RANKED_SOLO_5x5?.tierCn || '无段位',
      level: p.summoner?.summonerLevel,
      // 近期数据
      recentStats: {
        wins: p.userTag?.recentData?.selectWins || 0,
        losses: p.userTag?.recentData?.selectLosses || 0,
        winRate:
          p.userTag?.recentData?.selectWins && p.userTag?.recentData?.selectLosses
            ? Math.round(
                (p.userTag.recentData.selectWins /
                  (p.userTag.recentData.selectWins + p.userTag.recentData.selectLosses)) *
                  100
              )
            : 0,
        kda: p.userTag?.recentData?.kda?.toFixed(2) || '0.00',
        kills: p.userTag?.recentData?.kills?.toFixed(1) || '0.0',
        deaths: p.userTag?.recentData?.deaths?.toFixed(1) || '0.0',
        assists: p.userTag?.recentData?.assists?.toFixed(1) || '0.0',
        groupRate: p.userTag?.recentData?.groupRate || 0,
        damageRate: p.userTag?.recentData?.damageDealtToChampionsRate || 0
      },
      // 英雄熟练度
      topChampions,
      mainPosition,
      // 标签详情
      tags: tags.map((t: any) => ({
        name: t.tagName,
        desc: t.tagDesc,
        isGood: t.good
      })),
      // 最近10场详细战绩
      recentGamesPreview: recentGames.slice(0, 10).map((g: any) => ({
        champion: getChampionName(g.participants[0]?.championId),
        win: g.participants[0].stats.win,
        kills: g.participants[0].stats.kills,
        deaths: g.participants[0].stats.deaths,
        assists: g.participants[0].stats.assists,
        kda: (
          (g.participants[0].stats.kills + g.participants[0].stats.assists) /
          Math.max(g.participants[0].stats.deaths, 1)
        ).toFixed(2),
        damage: g.participants[0].stats.totalDamageDealtToChampions,
        gold: g.participants[0].stats.goldEarned,
        queue: g.queueName
      }))
    }
  })

  // 提取敌方队伍详细信息（同样的逻辑）
  const teamTwoInfo = sessionData.teamTwo?.map((p: any) => {
    const recentGames = p.matchHistory?.games?.games || []
    const tags = p.userTag?.tag || []

    const championStats: Record<
      number,
      { count: number; wins: number; totalKda: number; totalDamage: number }
    > = {}
    recentGames.forEach((g: any) => {
      const champId = g.participants[0]?.championId
      if (!champId) return
      if (!championStats[champId]) {
        championStats[champId] = { count: 0, wins: 0, totalKda: 0, totalDamage: 0 }
      }
      championStats[champId].count++
      if (g.participants[0].stats.win) championStats[champId].wins++
      const kda =
        (g.participants[0].stats.kills + g.participants[0].stats.assists) /
        Math.max(g.participants[0].stats.deaths, 1)
      championStats[champId].totalKda += kda
      championStats[champId].totalDamage += g.participants[0].stats.totalDamageDealtToChampions || 0
    })

    Object.keys(championStats).forEach(key => {
      const champ = championStats[Number(key)]
      champ.totalKda /= champ.count
      champ.totalDamage /= champ.count
    })

    const topChampions = Object.entries(championStats)
      .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
      .slice(0, 5)
      .map(([champId, stats]) => ({
        champion: getChampionName(Number(champId)),
        games: (stats as any).count,
        winRate: Math.round(((stats as any).wins / (stats as any).count) * 100),
        avgKda: (stats as any).totalKda.toFixed(2),
        avgDamage: Math.round((stats as any).totalDamage)
      }))

    const positionStats: Record<string, number> = {}
    recentGames.forEach((g: any) => {
      const pos =
        g.participants[0]?.timeline?.lane || g.participants[0]?.selectedPosition || 'UNKNOWN'
      positionStats[pos] = (positionStats[pos] || 0) + 1
    })

    const mainPosition = Object.entries(positionStats).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知'

    return {
      name: p.summoner?.gameName || '未知',
      currentChampion: getChampionName(p.championId),
      tier: p.rank?.queueMap?.RANKED_SOLO_5x5?.tierCn || '无段位',
      level: p.summoner?.summonerLevel,
      recentStats: {
        wins: p.userTag?.recentData?.selectWins || 0,
        losses: p.userTag?.recentData?.selectLosses || 0,
        winRate:
          p.userTag?.recentData?.selectWins && p.userTag?.recentData?.selectLosses
            ? Math.round(
                (p.userTag.recentData.selectWins /
                  (p.userTag.recentData.selectWins + p.userTag.recentData.selectLosses)) *
                  100
              )
            : 0,
        kda: p.userTag?.recentData?.kda?.toFixed(2) || '0.00',
        groupRate: p.userTag?.recentData?.groupRate || 0,
        damageRate: p.userTag?.recentData?.damageDealtToChampionsRate || 0
      },
      topChampions,
      mainPosition,
      tags: tags.map((t: any) => ({
        name: t.tagName,
        desc: t.tagDesc,
        isGood: t.good
      })),
      recentGamesPreview: recentGames.slice(0, 10).map((g: any) => ({
        champion: getChampionName(g.participants[0]?.championId),
        win: g.participants[0].stats.win,
        kills: g.participants[0].stats.kills,
        deaths: g.participants[0].stats.deaths,
        assists: g.participants[0].stats.assists,
        kda: (
          (g.participants[0].stats.kills + g.participants[0].stats.assists) /
          Math.max(g.participants[0].stats.deaths, 1)
        ).toFixed(2),
        queue: g.queueName
      }))
    }
  })

  return `你是LOL资深分析师，请从以下三个维度详细分析这局比赛：

【对局信息】
模式：${sessionData.typeCn || '未知'}

【我方队伍数据】
${JSON.stringify(teamOneInfo, null, 2)}

【敌方队伍数据】
${JSON.stringify(teamTwoInfo, null, 2)}

===== 请按以下结构分析（共300-400字）=====

一、阵容分析（80-100字）
- 双方阵容特点（控制、输出、前排等）
- 阵容优劣势对比
- 关键英雄作用

二、英雄熟练度与位置分析（100-120字）
- 每个玩家当前英雄 vs 常玩英雄对比
- 位置熟练度判断（是否拿手位置）
- 英雄池深度分析
- 可能的摇摆位

三、标签分析与战绩详情（120-180字）
针对有标签的玩家，详细分析：
- 标签产生原因（如"3连胜"、"KDA>=6"、"死亡>=10"等）
- 从最近战绩验证标签准确性
- 该玩家对本局的影响（正面大腿/负面隐患）
- 是否存在数据异常（如低KDA却有高胜率等）

【输出格式】
用简洁的要点形式，每个要点用•开头。重要信息用【】标注。正面标签用✅，负面标签用⚠️。`
}

/**
 * 构建单个玩家分析提示词
 */
function buildPlayerAnalysisPrompt(player: any): string {
  const recentGames = player.matchHistory?.games?.games || []
  const tags = player.userTag?.tag || []

  // 英雄统计
  const championStats: Record<
    number,
    { count: number; wins: number; totalKda: number; totalDamage: number }
  > = {}
  recentGames.forEach((g: any) => {
    const champId = g.participants[0]?.championId
    if (!champId) return
    if (!championStats[champId]) {
      championStats[champId] = { count: 0, wins: 0, totalKda: 0, totalDamage: 0 }
    }
    championStats[champId].count++
    if (g.participants[0].stats.win) championStats[champId].wins++
    const kda =
      (g.participants[0].stats.kills + g.participants[0].stats.assists) /
      Math.max(g.participants[0].stats.deaths, 1)
    championStats[champId].totalKda += kda
    championStats[champId].totalDamage += g.participants[0].stats.totalDamageDealtToChampions || 0
  })

  const topChampions = Object.entries(championStats)
    .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
    .slice(0, 5)
    .map(([champId, stats]) => ({
      champion: getChampionName(Number(champId)),
      games: (stats as any).count,
      winRate: Math.round(((stats as any).wins / (stats as any).count) * 100),
      avgKda: ((stats as any).totalKda / (stats as any).count).toFixed(2),
      avgDamage: Math.round((stats as any).totalDamage / (stats as any).count)
    }))

  // 位置统计
  const positionStats: Record<string, number> = {}
  recentGames.forEach((g: any) => {
    const pos = g.participants[0]?.timeline?.lane || 'UNKNOWN'
    positionStats[pos] = (positionStats[pos] || 0) + 1
  })

  // 详细战绩（增加到15场）
  const detailedGames = recentGames.slice(0, 15).map((g: any) => ({
    champion: getChampionName(g.participants[0]?.championId),
    win: g.participants[0].stats.win,
    kills: g.participants[0].stats.kills,
    deaths: g.participants[0].stats.deaths,
    assists: g.participants[0].stats.assists,
    kda: (
      (g.participants[0].stats.kills + g.participants[0].stats.assists) /
      Math.max(g.participants[0].stats.deaths, 1)
    ).toFixed(2),
    damage: g.participants[0].stats.totalDamageDealtToChampions,
    gold: g.participants[0].stats.goldEarned,
    queue: g.queueName,
    gameMode: g.gameMode
  }))

  return `你是LOL资深分析师，请详细分析这个玩家：

【玩家基本信息】
名称：${player.summoner?.gameName || '未知'} #${player.summoner?.tagLine}
等级：${player.summoner?.summonerLevel}
段位：${player.rank?.queueMap?.RANKED_SOLO_5x5?.tierCn || '无'}

【近期统计】
模式：${player.userTag?.recentData?.selectModeCn || '未知'}
胜率：${player.userTag?.recentData?.selectWins || 0}胜${player.userTag?.recentData?.selectLosses || 0}负 (${
    player.userTag?.recentData?.selectWins && player.userTag?.recentData?.selectLosses
      ? Math.round(
          (player.userTag.recentData.selectWins /
            (player.userTag.recentData.selectWins + player.userTag.recentData.selectLosses)) *
            100
        )
      : 0
  }%)
KDA：${player.userTag?.recentData?.kda?.toFixed(2) || 0}
场均：${player.userTag?.recentData?.kills?.toFixed(1) || 0}/${player.userTag?.recentData?.deaths?.toFixed(1) || 0}/${player.userTag?.recentData?.assists?.toFixed(1) || 0}
参团率：${player.userTag?.recentData?.groupRate || 0}%
伤害占比：${player.userTag?.recentData?.damageDealtToChampionsRate || 0}%

【英雄熟练度】
${JSON.stringify(topChampions, null, 2)}

【位置分布】
${JSON.stringify(positionStats, null, 2)}

【标签列表】
${tags.length > 0 ? tags.map((t: any) => `• ${t.tagName}(${t.tagDesc}) - ${t.good ? '正面' : '负面'}`).join('\n') : '无标签'}

【最近15场详细战绩】
${JSON.stringify(detailedGames, null, 2)}

===== 请按以下结构分析（共200-250字）=====

一、实力评估（60-80字）
- 整体水平判断
- 位置和英雄熟练度
- 操作习惯特点

二、标签深度分析（80-100字）
针对每个标签：
- 产生原因分析
- 从战绩数据验证
- 标签准确性判断

三、战绩异常检测（40-60字）
- 数据一致性检查
- 异常表现分析（如连胜/连败、KDA异常等）
- 可能的代练/摆子迹象

【输出格式】
用简洁的要点形式，每个要点用•开头。重要信息用【】标注。正面标签用✅，负面标签用⚠️。`
}

export async function analyzeMatchDetailWithAI(
  game: Game,
  options: MatchDetailAnalysisOptions = {}
): Promise<AIAnalysisResult> {
  try {
    await loadChampionNames()

    const mode = options.mode ?? 'overview'
    const prompt =
      mode === 'player'
        ? buildMatchPlayerAnalysisPrompt(game, options.participantId)
        : buildMatchOverviewAnalysisPrompt(game)

    const cacheKey =
      mode === 'player'
        ? `match_detail_player_${game.gameId}_${options.participantId ?? 'unknown'}`
        : `match_detail_overview_${game.gameId}`

    return await requestAIContent(prompt, cacheKey)
  } catch (error: any) {
    console.error('Match detail AI analysis error:', error)
    return {
      success: false,
      error: error.message || '网络请求失败'
    }
  }
}

function getParticipants(game: Game): Participant[] {
  return game.gameDetail?.participants?.length ? game.gameDetail.participants : game.participants
}

function getParticipantIdentities(game: Game): MatchPlayerIdentity[] {
  return game.gameDetail?.participantIdentities?.length
    ? game.gameDetail.participantIdentities
    : game.participantIdentities
}

function buildDisplayName(identity: MatchPlayerIdentity | undefined, fallbackId: number) {
  if (!identity) {
    return `玩家${fallbackId}`
  }

  return `${identity.player.gameName}#${identity.player.tagLine}`
}

function getCurrentPlayerKey(game: Game) {
  const current = game.participantIdentities?.[0]?.player
  if (!current) {
    return ''
  }

  return `${current.gameName}#${current.tagLine}`
}

function getAugmentIds(stats: ParticipantStats) {
  return [
    stats.playerAugment1,
    stats.playerAugment2,
    stats.playerAugment3,
    stats.playerAugment4
  ].filter(augmentId => augmentId > 0)
}

function isAugmentMode(game: Game) {
  return (
    game.queueId === 1700 ||
    game.queueId === 2400 ||
    /斗魂竞技场|海克斯乱斗|海克斯大乱斗/.test(game.queueName || '')
  )
}

function roundStat(value: number, digits: number = 1) {
  return Number(value.toFixed(digits))
}

function totalCs(stats: ParticipantStats) {
  return stats.totalMinionsKilled + stats.neutralMinionsKilled
}

function kda(stats: ParticipantStats) {
  return (stats.kills + stats.assists) / Math.max(1, stats.deaths)
}

function percentOf(value: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return roundStat((value / total) * 100)
}

function buildMatchSnapshot(game: Game) {
  const participants = getParticipants(game)
  const identities = getParticipantIdentities(game)
  const currentPlayerKey = getCurrentPlayerKey(game)

  const teamTotals = new Map<
    number,
    { damage: number; taken: number; gold: number; kills: number }
  >()
  for (const participant of participants) {
    const current = teamTotals.get(participant.teamId) ?? { damage: 0, taken: 0, gold: 0, kills: 0 }
    current.damage += participant.stats.totalDamageDealtToChampions
    current.taken += participant.stats.totalDamageTaken
    current.gold += participant.stats.goldEarned
    current.kills += participant.stats.kills
    teamTotals.set(participant.teamId, current)
  }

  const players = participants.map((participant, index) => {
    const identity = identities[participant.participantId - 1] ?? identities[index]
    const displayName = buildDisplayName(identity, participant.participantId)
    const totals = teamTotals.get(participant.teamId) ?? { damage: 0, taken: 0, gold: 0, kills: 0 }

    return {
      participantId: participant.participantId,
      teamId: participant.teamId,
      name: displayName,
      champion: getChampionName(participant.championId),
      spellIds: [participant.spell1Id, participant.spell2Id],
      isMe: displayName === currentPlayerKey,
      win: participant.stats.win,
      kda: roundStat(kda(participant.stats), 2),
      kills: participant.stats.kills,
      deaths: participant.stats.deaths,
      assists: participant.stats.assists,
      gold: participant.stats.goldEarned,
      cs: totalCs(participant.stats),
      damage: participant.stats.totalDamageDealtToChampions,
      taken: participant.stats.totalDamageTaken,
      heal: participant.stats.totalHeal,
      turretDamage: participant.stats.damageDealtToTurrets,
      damageShare: percentOf(participant.stats.totalDamageDealtToChampions, totals.damage),
      damageTakenShare: percentOf(participant.stats.totalDamageTaken, totals.taken),
      goldShare: percentOf(participant.stats.goldEarned, totals.gold),
      killParticipation: percentOf(
        participant.stats.kills + participant.stats.assists,
        Math.max(totals.kills, 1)
      ),
      perks: {
        primary: participant.stats.perk0,
        subStyle: participant.stats.perkSubStyle
      },
      augments: getAugmentIds(participant.stats)
    }
  })

  const teams = [...new Set(players.map(player => player.teamId))]
    .map(teamId => {
      const teamPlayers = players.filter(player => player.teamId === teamId)

      return {
        teamId,
        result: teamPlayers[0]?.win ? '胜方' : '败方',
        totalKills: teamPlayers.reduce((sum, player) => sum + player.kills, 0),
        totalDeaths: teamPlayers.reduce((sum, player) => sum + player.deaths, 0),
        totalAssists: teamPlayers.reduce((sum, player) => sum + player.assists, 0),
        totalDamage: teamPlayers.reduce((sum, player) => sum + player.damage, 0),
        totalTaken: teamPlayers.reduce((sum, player) => sum + player.taken, 0),
        totalGold: teamPlayers.reduce((sum, player) => sum + player.gold, 0),
        players: [...teamPlayers].sort((left, right) => left.participantId - right.participantId)
      }
    })
    .sort(
      (left, right) =>
        Number(right.players[0]?.win ?? false) - Number(left.players[0]?.win ?? false)
    )

  return {
    gameId: game.gameId,
    queueName: game.queueName,
    queueId: game.queueId,
    gameMode: game.gameMode,
    durationSeconds: game.gameDuration,
    augmentMode: isAugmentMode(game),
    teams,
    players
  }
}

function buildMatchOverviewAnalysisPrompt(game: Game) {
  const snapshot = buildMatchSnapshot(game)

  return `你是 LOL 单场复盘分析师。请只基于下面这场比赛的数据做结论，不要编造对线细节、团战时间点或装备效果。

【任务目标】
请你判断这场比赛里：
1. 谁最尽力
2. 谁最犯罪
3. 谁是被对位或被局势打爆的
4. 谁属于被队友连累
5. 胜负的核心原因是什么

【标签定义】
- 缚地灵：指那些整场游戏几乎不参与团战、只待在自己线上/野区刷资源的玩家，特征是低参团率、低助攻、低伤害，但补刀/经济未必低。

【硬性要求】
- 每个判断都必须引用至少 2 个具体数据证据，例如 KDA、伤害占比、承伤占比、经济、参团率、推塔、死亡数。
- 不要因为输了就默认某个人犯罪，也不要因为赢了就默认某个人尽力。
- “被连累”只给在败方里数据明显完成职责、但团队整体明显失衡的人。
- “被爆”优先看高死亡、低经济占比、低输出占比、低参团，或者同队里明显拖后腿。
- 允许结论为”无人明显犯罪”或”多人都尽力”。
- 语气直接，但不要人身攻击。

【负面标签申辩机制】
当判定某玩家为负面标签时，必须同时考虑以下申辩理由：
1. 位置因素：下路双人路天然容易被针对，ADC/辅助死亡多可能是被4包2越塔，而非自己打得差
2. 补位因素：如果该玩家明显在玩非主玩位置（从英雄熟练度、位置分布判断），失误率高应给予理解
3. 被针对因素：如果该玩家被敌方频繁gank（可从死亡时间分布推断），或敌方打野长期蹲守某路
4. 团队因素：如果某路队友崩盘导致自己被连带（如上路炸了导致对面打野自由入侵下路野区）
5. 英雄克制：如果存在明显的英雄劣势对线（如短手打长手），KDA差应部分归因于BP

【申辩权重】
- 主玩位置+非明显被针对：负面标签有效
- 补位/被明显针对/团队连累：降级为”情有可原”或改判为”被连累”
- 无法判断时优先选择较温和的表述

【对局信息】
模式：${snapshot.queueName}
队列ID：${snapshot.queueId}
游戏模式：${snapshot.gameMode}
时长：${Math.floor(snapshot.durationSeconds / 60)}分${snapshot.durationSeconds % 60}秒
构筑类型：${snapshot.augmentMode ? '海克斯/强化局，优先看强化搭配' : '常规局，优先看符文与基础数据'}

【全场数据快照】
${JSON.stringify(snapshot, null, 2)}

【输出格式】
请严格按这个结构输出：

## 总体结论
- 先用 2-3 句话总结胜负原因。

## 尽力榜
- 只列 1-2 人。
- 每人一行：名字 + 判定 + 证据。

## 犯罪榜
- 只列 1-2 人。
- 如果没有明显犯罪，明确写“本局无人明显犯罪”。

## 被爆点评
- 点出 1-2 个最明显的崩点。

## 被连累点评
- 如果有人属于被连累，说明他做到了什么、却被哪些队友问题拖垮。

## 关键证据
- 用 3-5 条 bullet 收尾，每条都带数字。`
}

function buildMatchPlayerAnalysisPrompt(game: Game, participantId?: number) {
  const snapshot = buildMatchSnapshot(game)
  const targetPlayer =
    snapshot.players.find(player => player.participantId === participantId) ??
    snapshot.players.find(player => player.isMe) ??
    snapshot.players[0]

  const sameTeamPlayers = snapshot.players.filter(player => player.teamId === targetPlayer.teamId)
  const enemyPlayers = snapshot.players.filter(player => player.teamId !== targetPlayer.teamId)

  return `你是 LOL 单人复盘分析师。请围绕指定玩家，判断他这局到底属于”尽力、犯罪、被爆、被连累、缚地灵、正常发挥”中的哪一类。

【标签定义】
- 缚地灵：指那些整场游戏几乎不参与团战、只待在自己线上/野区刷资源的玩家，特征是低参团率（低于团队平均15%以上）、低助攻、低伤害占比，但补刀/经济未必低。常见于”单机”型上单或刷子型打野。

【硬性要求】
- 必须先给出唯一主标签，只能从：尽力 / 犯罪 / 被爆 / 被连累 / 缚地灵 / 正常发挥 中选一个。
- 所有结论必须基于数据，至少引用 3 个具体指标。
- 要区分”自己打得差”和”队友整体拖垮”这两种情况。
- 如果是海克斯/强化模式，请结合强化数量和构筑方向，判断是否成型。
- 不要空泛鼓励，不要写成攻略。

【负面标签申辩机制】
当判定为”犯罪”、”被爆”或”缚地灵”时，必须同时评估以下申辩理由：
1. 位置因素：
   - 下路双人路天然容易被针对，ADC/辅助死亡多可能是被4包2越塔
   - 上路长线容易被军训，死亡多不代表对线实力差
   - 打野被反野可能是因为线上没线权支援
2. 补位因素：
   - 如果该玩家明显在玩非主玩位置（从近期位置分布判断），失误率应给予折扣
   - 补位玩家数据差时，优先标记为”情有可原”而非”犯罪”
3. 被针对因素：
   - 如果该玩家死亡集中在前期（对线期），可能是被针对而非操作问题
   - 如果敌方打野/中单的击杀数中该玩家占比过高，说明被重点照顾
4. 团队连累：
   - 如果某路队友崩盘导致自己被连带（如上路炸了导致对面打野自由入侵）
   - 如果己方整体阵容前期弱势导致全线被压
5. 英雄克制：
   - 如果存在明显的英雄劣势对线（如短手打长手），KDA差应部分归因于BP
   - 如果己方阵容缺乏开团/保护导致某位置无法发挥

【申辩判定】
- 满足2项以上申辩理由：改判为”被连累”或”情有可原的正常发挥”
- 满足1项申辩理由：负面标签保留，但备注申辩原因
- 不满足申辩理由：负面标签成立，给出直接批评

【对局信息】
模式：${snapshot.queueName}
时长：${Math.floor(snapshot.durationSeconds / 60)}分${snapshot.durationSeconds % 60}秒
构筑类型：${snapshot.augmentMode ? '海克斯/强化局' : '常规局'}

【目标玩家】
${JSON.stringify(targetPlayer, null, 2)}

【同队玩家】
${JSON.stringify(sameTeamPlayers, null, 2)}

【敌方玩家】
${JSON.stringify(enemyPlayers, null, 2)}

【输出格式】
请严格按这个结构输出：

## 玩家判定
- 先写：名字 + 主标签（如果是负面标签且通过申辩，写"XXX（情有可原）"）。

## 为什么这么判
- 用 3-4 条 bullet 解释，必须带数字。

## 申辩评估（仅负面标签需要）
- 逐条评估5类申辩理由（位置/补位/被针对/团队连累/英雄克制）
- 写明：该理由是否成立 + 简要依据
- 例如："位置因素：成立，下路死亡多发生在前期被4包2" 或 "补位因素：不成立，该玩家近期70%对局为打野位"

## 他是怎么输/赢的
- 说明是自己打出来的、被针对的、还是被队友带飞/拖累。
- 如果存在申辩理由成立，重点说明。

## 一句话锐评
- 用一句短评收尾，允许直接一点，但不要辱骂。`
}
