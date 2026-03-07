use crate::{
    constant,
    lcu::util::http::{self, lcu_get},
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, RwLock};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Champion {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub alias: String,
    pub content_id: String,
    pub square_portrait_path: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub icon_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Perk {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub tooltip: String,
    #[serde(default)]
    pub short_desc: String,
    #[serde(default)]
    pub long_desc: String,
    #[serde(default)]
    pub rarity: Option<String>,
    pub icon_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CherryAugment {
    pub id: i64,
    #[serde(rename = "nameTRA", default)]
    pub name_tra: String,
    #[serde(rename = "descriptionTRA", default)]
    pub description_tra: String,
    #[serde(default)]
    pub tooltip: String,
    #[serde(rename = "augmentSmallIconPath", default)]
    pub augment_small_icon_path: String,
    #[serde(rename = "iconLargePath", default)]
    pub icon_large_path: String,
    #[serde(default)]
    pub rarity: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PerkStyle {
    pub id: i64,
    pub name: String,
    pub icon_path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PerkStylesResponse {
    pub styles: Vec<PerkStyle>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssetDetails {
    pub id: i64,
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rarity: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Spell {
    pub id: i64,
    pub icon_path: String,
}

// NOTE: switched from moka::Cache to RwLock<HashMap<..>> to support direct iteration.
// If TTL/size-based eviction is later required, consider wrapping with moka again or
// implementing a lightweight LRU.
pub static CHAMPION_CACHE: LazyLock<RwLock<HashMap<i64, Champion>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));
static ITEM_CACHE: LazyLock<RwLock<HashMap<i64, Item>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));
static PERK_CACHE: LazyLock<RwLock<HashMap<i64, Perk>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));
static SPELL_CACHE: LazyLock<RwLock<HashMap<i64, Spell>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));
static ASSET_TAG_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<[^>]+>").expect("valid asset html regex"));

// Keep binary cache as moka for weighted size-based eviction (still useful) - optional future refactor.
use moka::future::Cache; // retained only for BINARY_CACHE
static BINARY_CACHE: LazyLock<Cache<String, (Vec<u8>, String)>> = LazyLock::new(|| {
    Cache::builder()
        .weigher(|_k: &String, v: &(Vec<u8>, String)| v.0.len() as u32)
        .build()
});

pub async fn init() {
    log::info!("Initializing asset API caches");
    let items = lcu_get::<Vec<Item>>(constant::api::ITEM_URI).await.unwrap();
    let champions = lcu_get::<Vec<Champion>>(constant::api::CHAMPION_URI)
        .await
        .unwrap();
    let spells = lcu_get::<Vec<Spell>>(constant::api::SPELL_URI)
        .await
        .unwrap();
    let perk_styles = lcu_get::<PerkStylesResponse>(constant::api::PERK_URI)
        .await
        .unwrap();
    let perks = lcu_get::<Vec<Perk>>(constant::api::PERKS_URI)
        .await
        .unwrap();
    let cherry_augments =
        match lcu_get::<Vec<CherryAugment>>(constant::api::CHERRY_AUGMENTS_URI).await {
            Ok(augments) => augments,
            Err(error) => {
                log::warn!("Failed to load cherry augments: {}", error);
                Vec::new()
            }
        };
    let perk_styles_only: Vec<Perk> = perk_styles
        .styles
        .into_iter()
        .map(|perk_style| Perk {
            id: perk_style.id,
            name: perk_style.name,
            tooltip: String::new(),
            short_desc: String::new(),
            long_desc: String::new(),
            rarity: None,
            icon_path: perk_style.icon_path,
        })
        .collect();
    let cherry_augment_perks: Vec<Perk> = cherry_augments
        .into_iter()
        .map(|augment| Perk {
            id: augment.id,
            name: if augment.name_tra.is_empty() {
                format!("Augment {}", augment.id)
            } else {
                augment.name_tra
            },
            tooltip: augment.tooltip,
            short_desc: String::new(),
            long_desc: augment.description_tra,
            rarity: if augment.rarity.is_empty() {
                None
            } else {
                Some(augment.rarity)
            },
            icon_path: if augment.augment_small_icon_path.is_empty() {
                augment.icon_large_path
            } else {
                augment.augment_small_icon_path
            },
        })
        .collect();

    // 先记录长度，避免后续 move
    let item_count = items.len();
    let champion_count = champions.len();
    let spell_count = spells.len();
    let perk_style_count = perk_styles_only.len();
    let perk_count = perks.len();
    let cherry_augment_count = cherry_augment_perks.len();

    // 将数据存储到缓存中
    {
        let mut map = ITEM_CACHE.write().unwrap();
        for item in items {
            map.insert(item.id, item);
        }
    }
    {
        let mut map = CHAMPION_CACHE.write().unwrap();
        for champion in champions {
            map.insert(champion.id, champion);
        }
    }
    {
        let mut map = SPELL_CACHE.write().unwrap();
        for spell in spells {
            map.insert(spell.id, spell);
        }
    }
    {
        let mut map = PERK_CACHE.write().unwrap();
        for perk in perk_styles_only {
            map.insert(perk.id, perk);
        }
        for perk in perks {
            map.insert(perk.id, perk);
        }
        for augment in cherry_augment_perks {
            map.insert(augment.id, augment);
        }
    }
    log::info!("item count: {}", item_count);
    log::info!("champion count: {}", champion_count);
    log::info!("spell count: {}", spell_count);
    log::info!("perk style count: {}", perk_style_count);
    log::info!("perk count: {}", perk_count);
    log::info!("cherry augment count: {}", cherry_augment_count);
    log::info!("Asset API caches initialized successfully");
}

// 新增：返回二进制与 content-type，便于通过 HTTP 下发
pub async fn get_asset_binary(type_string: String, id: i64) -> Result<(Vec<u8>, String), String> {
    let cache_key = build_asset_key(&type_string, id);
    if let Some(hit) = BINARY_CACHE.get(&cache_key).await {
        return Ok(hit);
    }

    let result = match type_string.as_str() {
        "champion" => get_champion_binary(id).await,
        "item" => get_item_binary(id).await,
        "perk" => get_perk_binary(id).await,
        "spell" => get_spell_binary(id).await,
        "profile" => get_profile_binary(id).await,
        _ => Err("Invalid type string".to_string()),
    }?;

    // 写入缓存
    BINARY_CACHE.insert(cache_key, result.clone()).await;
    Ok(result)
}

async fn fetch_binary(url: &str) -> Result<(Vec<u8>, String), String> {
    http::lcu_get_img_as_binary(url).await
}

// 新增：各类型的二进制获取
async fn get_champion_binary(id: i64) -> Result<(Vec<u8>, String), String> {
    let chapmpion = {
        let cache = CHAMPION_CACHE.read().unwrap();
        cache.get(&id).cloned()
    };
    match chapmpion {
        Some(champion) => {
            log::info!("Getting champion binary for id {}", id);
            fetch_binary(&champion.square_portrait_path).await
        }
        None => Err(format!("Champion with id {} not found in cache", id)),
    }
}

async fn get_item_binary(id: i64) -> Result<(Vec<u8>, String), String> {
    let item = {
        let cache = ITEM_CACHE.read().unwrap();
        cache.get(&id).cloned()
    };
    match item {
        Some(item) => {
            log::info!("Getting item binary for id {}", id);
            fetch_binary(&item.icon_path).await
        }
        None => Err(format!("Item with id {} not found in cache", id)),
    }
}

async fn get_spell_binary(id: i64) -> Result<(Vec<u8>, String), String> {
    let spell = {
        let cache = SPELL_CACHE.read().unwrap();
        cache.get(&id).cloned()
    };
    match spell {
        Some(spell) => {
            log::info!("Getting spell binary for id {}", id);
            fetch_binary(&spell.icon_path).await
        }
        None => Err(format!("Spell with id {} not found in cache", id)),
    }
}

async fn get_perk_binary(id: i64) -> Result<(Vec<u8>, String), String> {
    let perk = {
        let cache = PERK_CACHE.read().unwrap();
        cache.get(&id).cloned()
    };
    match perk {
        Some(perk) => {
            log::info!("Getting perk binary for id {}", id);
            fetch_binary(&perk.icon_path).await
        }
        None => Err(format!("Perk with id {} not found in cache", id)),
    }
}

async fn get_profile_binary(id: i64) -> Result<(Vec<u8>, String), String> {
    log::info!("Getting profile binary for id {}", id);
    let profile_url = format!("/lol-game-data/assets/v1/profile-icons/{}.jpg", id);
    fetch_binary(&profile_url).await
}

fn build_asset_key(type_string: &str, id: i64) -> String {
    format!("{}:{}", type_string, id)
}

pub fn get_asset_details(type_string: String, ids: Vec<i64>) -> Result<Vec<AssetDetails>, String> {
    match type_string.as_str() {
        "item" => Ok(get_item_details(ids)),
        "perk" => Ok(get_perk_details(ids)),
        _ => Err("Invalid type string".to_string()),
    }
}

fn get_item_details(ids: Vec<i64>) -> Vec<AssetDetails> {
    let cache = ITEM_CACHE.read().unwrap();
    collect_unique_ids(ids)
        .into_iter()
        .filter_map(|id| {
            cache.get(&id).map(|item| AssetDetails {
                id,
                name: item.name.clone(),
                description: normalize_asset_text(&item.description).unwrap_or_default(),
                rarity: None,
            })
        })
        .collect()
}

fn get_perk_details(ids: Vec<i64>) -> Vec<AssetDetails> {
    let cache = PERK_CACHE.read().unwrap();
    collect_unique_ids(ids)
        .into_iter()
        .filter_map(|id| {
            cache.get(&id).map(|perk| AssetDetails {
                id,
                name: perk.name.clone(),
                description: normalize_asset_text(&perk.long_desc)
                    .or_else(|| normalize_asset_text(&perk.tooltip))
                    .or_else(|| normalize_asset_text(&perk.short_desc))
                    .unwrap_or_default(),
                rarity: perk.rarity.clone(),
            })
        })
        .collect()
}

fn collect_unique_ids(ids: Vec<i64>) -> Vec<i64> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for id in ids {
        if id <= 0 || !seen.insert(id) {
            continue;
        }
        result.push(id);
    }

    result
}

fn normalize_asset_text(raw: &str) -> Option<String> {
    if raw.trim().is_empty() {
        return None;
    }

    let with_breaks = raw
        .replace("<br />", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("<hr />", "\n")
        .replace("<hr/>", "\n")
        .replace("<hr>", "\n")
        .replace("</li>", "\n")
        .replace("<li>", "• ")
        .replace("</p>", "\n")
        .replace("<p>", "");

    let without_tags = ASSET_TAG_REGEX.replace_all(&with_breaks, "");
    let decoded = without_tags
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");

    let mut lines = Vec::new();
    let mut previous_blank = false;

    for line in decoded.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !previous_blank && !lines.is_empty() {
                lines.push(String::new());
            }
            previous_blank = true;
            continue;
        }

        lines.push(trimmed.to_string());
        previous_blank = false;
    }

    while matches!(lines.last(), Some(last) if last.is_empty()) {
        lines.pop();
    }

    if lines.is_empty() {
        None
    } else {
        Some(lines.join("\n"))
    }
}
