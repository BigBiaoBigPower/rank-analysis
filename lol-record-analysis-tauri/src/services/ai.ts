const AI_PROXY_URL = 'https://ai.nuliyangguang.top'

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

    // 检查缓存
    const cacheKey = `ai_${type}_${JSON.stringify(prompt)}`
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
            content:
              '你是一个LOL游戏分析师，擅长分析玩家战绩和给出游戏建议。请用简洁的中文回复，不要太长。'
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
      // 缓存结果
      sessionStorage.setItem(cacheKey, content)

      return {
        success: true,
        content
      }
    } else if (data.error) {
      return {
        success: false,
        error: data.error.message || 'AI 分析失败'
      }
    } else {
      return {
        success: false,
        error: '未知错误'
      }
    }
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
