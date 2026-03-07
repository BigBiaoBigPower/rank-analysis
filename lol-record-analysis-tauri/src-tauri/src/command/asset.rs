//! # Asset 命令模块
//!
//! 提供前端悬浮说明所需的资产元数据，如物品和符文名称、描述等。

use crate::lcu::api::asset::{self, AssetDetails};

#[tauri::command]
pub fn get_asset_details(type_string: String, ids: Vec<i64>) -> Result<Vec<AssetDetails>, String> {
    asset::get_asset_details(type_string, ids)
}
