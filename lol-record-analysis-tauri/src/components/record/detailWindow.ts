import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Game } from './match'

function getMatchDetailWindowLabel(game: Game) {
  return `match-detail-${game.gameId}`
}

function getMatchDetailStorageKey(game: Game) {
  return `match-detail:${game.gameId}`
}

function buildMatchDetailUrl() {
  return `${window.location.origin}`
}

function persistMatchDetail(storageKey: string, game: Game) {
  localStorage.setItem(storageKey, JSON.stringify(game))
}

export async function openMatchDetailWindow(game: Game) {
  const windowLabel = getMatchDetailWindowLabel(game)
  const storageKey = getMatchDetailStorageKey(game)

  persistMatchDetail(storageKey, game)

  const existingWindow = await WebviewWindow.getByLabel(windowLabel)
  if (existingWindow) {
    await existingWindow.show()
    await existingWindow.setFocus()
    return
  }

  const detailWindow = new WebviewWindow(windowLabel, {
    title: '对局详情',
    url: buildMatchDetailUrl(),
    width: 1300,
    height: 900,
    minWidth: 1300,
    minHeight: 760,
    center: true,
    resizable: true,
    focus: true,
    decorations: false,
    transparent: false,
    shadow: true
  })

  detailWindow.once('tauri://created', async () => {
    await detailWindow.setFocus()
  })

  detailWindow.once('tauri://error', error => {
    console.error('Failed to create match detail window:', error)
  })
}
