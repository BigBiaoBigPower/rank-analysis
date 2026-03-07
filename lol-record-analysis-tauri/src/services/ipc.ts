import { invoke } from '@tauri-apps/api/core'

export interface AssetDetail {
  id: number
  name: string
  description: string
  rarity?: string
}

export async function getImgBase64ByIpc(typeString: string, id: number) {
  const base64 = await invoke<string>('get_asset_base64', { typeString, id })
  return base64
}

export async function putConfigByIpc(key: string, value: any) {
  await invoke('put_config', { key, value })
}

interface ConfigValue {
  value: any
}
export async function getConfigByIpc<T>(key: string) {
  const configValue = await invoke<ConfigValue>('get_config', { key })
  return configValue.value as T
}

export async function getGameModesByIpc() {
  return await invoke<{ label: string; value: number }[]>('get_game_modes')
}

export async function getAssetDetailsByIpc(typeString: 'item' | 'perk', ids: number[]) {
  return await invoke<AssetDetail[]>('get_asset_details', { typeString, ids })
}
