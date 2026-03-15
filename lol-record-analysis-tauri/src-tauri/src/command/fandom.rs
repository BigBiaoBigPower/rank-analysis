//! # Fandom 命令模块
//!
//! 与 Fandom 外部数据对接：更新大乱斗平衡数据、按英雄 ID 查询平衡信息。
//!
//! ## 主要功能
//!
//! - **数据更新**: 从 Fandom 拉取最新的大乱斗平衡数据
//! - **数据查询**: 根据英雄 ID 查询平衡数据
//! - **缓存管理**: 使用应用状态的缓存存储平衡数据
//!
//! ## 大乱斗平衡数据
//!
//! 包含以下信息：
//! - 伤害调整（造成/受到）
//! - 治疗调整
//! - 护盾调整
//! - 其他特殊调整
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! // 更新数据
//! let result = update_fandom_data(state).await?;
//!
//! // 查询特定英雄的平衡数据
//! let balance = get_aram_balance(91, state).await?; // 91 = 卡特琳娜
//! ```

use crate::fandom::api::fetch_aram_balance_data;
use crate::fandom::data::AramBalanceData;
use crate::state::AppState;
use tauri::State;

/// 从 Fandom 拉取大乱斗平衡数据并写入应用缓存。
///
/// # 参数
///
/// - `state`: Tauri 应用状态，包含 Fandom 数据缓存
///
/// # 返回值
///
/// - `Ok(String)`: 更新成功消息
/// - `Err(String)`: 更新失败时的错误信息
///
/// # 缓存策略
///
/// 数据会被写入 `AppState.fandom_cache`，该缓存有 2 小时的 TTL。
#[tauri::command]
pub async fn update_fandom_data(state: State<'_, AppState>) -> Result<String, String> {
    match fetch_aram_balance_data().await {
        Ok(data) => {
            for (id, balance) in data {
                state.fandom_cache.insert(id, balance).await;
            }
            Ok("Fandom data updated successfully".to_string())
        }
        Err(e) => Err(format!("Failed to update fandom data: {}", e)),
    }
}

/// 根据英雄 ID 从缓存获取大乱斗平衡数据。
///
/// # 参数
///
/// - `id`: 英雄 ID
/// - `state`: Tauri 应用状态，包含 Fandom 数据缓存
///
/// # 返回值
///
/// - `Ok(Some(AramBalanceData))`: 找到平衡数据
/// - `Ok(None)`: 该英雄无平衡调整
/// - `Err(String)`: 查询失败时的错误信息
///
/// # 使用建议
///
/// 如果返回 `None`，表示该英雄在大乱斗中没有特殊平衡调整（伤害/治疗等均为默认值）。
#[tauri::command]
pub async fn get_aram_balance(
    id: i32,
    state: State<'_, AppState>,
) -> Result<Option<AramBalanceData>, String> {
    Ok(state.fandom_cache.get(&id).await)
}
