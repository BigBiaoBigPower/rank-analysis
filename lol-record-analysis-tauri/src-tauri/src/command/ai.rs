//! # AI 分析命令模块
//!
//! 提供流式 AI 分析功能，调用 Cloudflare Workers AI API。
//!
//! ## 主要功能
//!
//! - **流式 AI 请求**: 通过 Tauri Channel 实现 SSE 流式输出到前端
//! - **Cloudflare AI**: 调用 @cf/qwen/qwen2.5-coder-14b-instruct 模型
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! // 前端调用
//! let (rx, tx) = channel::<String>();
//! invoke('stream_ai_analysis', {
//!   prompt: "分析这段战绩...",
//!   system_prompt: "你是LOL分析师...",
//!   onChunk: (chunk) => console.log(chunk)
//! })
//! ```

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tauri::ipc::Channel;

/// AI 请求参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStreamRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub account_id: String,
    pub api_token: String,
}

/// AI 流式响应事件
#[derive(Debug, Clone, Serialize)]
pub struct AiStreamEvent {
    /// 事件类型: "chunk" | "done" | "error"
    pub event: String,
    /// 数据内容（chunk 时为文本，error 时为错误信息）
    pub data: Option<String>,
}

/// 流式 AI 分析命令
///
/// # 参数
///
/// - `request`: AI 请求参数（包含 prompt 和可选的 system_prompt）
/// - `on_event`: Tauri Channel，用于向前端发送流式事件
///
/// # 返回值
///
/// - `Ok(())`: 流式传输完成
/// - `Err(String)`: 请求失败，返回错误信息
#[tauri::command]
pub async fn stream_ai_analysis(
    request: AiStreamRequest,
    on_event: Channel<AiStreamEvent>,
) -> Result<(), String> {
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/qwen/qwen2.5-coder-14b-instruct",
        request.account_id
    );

    // 构建请求头
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", request.api_token))
            .map_err(|e| format!("Invalid API token: {}", e))?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    // 构建请求体
    let system_prompt = request
        .system_prompt
        .unwrap_or_else(|| "你是一个LOL游戏分析师，擅长分析玩家战绩和给出游戏建议。请用简洁、专业、直接的中文回复。".to_string());

    let body = json!({
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": request.prompt
            }
        ],
        "stream": true
    });

    // 创建 HTTP 客户端
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // 发送请求
    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    // 检查响应状态
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error ({}): {}", status, error_text));
    }

    // 获取响应流
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    use futures::StreamExt;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                buffer.push_str(&String::from_utf8_lossy(&bytes));

                // 处理缓冲区的完整行
                while let Some(line_end) = buffer.find('\n') {
                    let line = buffer[..line_end].trim().to_string();
                    buffer = buffer[line_end + 1..].to_string();

                    if line.is_empty() || line == "data: [DONE]" {
                        continue;
                    }

                    // 解析 SSE 数据行
                    if let Some(data) = line.strip_prefix("data: ") {
                        match serde_json::from_str::<serde_json::Value>(data) {
                            Ok(json) => {
                                // 提取响应内容
                                let content = json
                                    .get("response")
                                    .and_then(|v| v.as_str())
                                    .or_else(|| {
                                        json.get("choices")
                                            .and_then(|c| c.get(0))
                                            .and_then(|c| c.get("delta"))
                                            .and_then(|d| d.get("content"))
                                            .and_then(|c| c.as_str())
                                    })
                                    .unwrap_or("")
                                    .to_string();

                                if !content.is_empty() {
                                    // 发送 chunk 事件到前端
                                    let _ = on_event.send(AiStreamEvent {
                                        event: "chunk".to_string(),
                                        data: Some(content),
                                    });
                                }
                            }
                            Err(_) => {
                                // 忽略解析错误，继续处理
                            }
                        }
                    }
                }
            }
            Err(e) => {
                // 发送错误事件
                let _ = on_event.send(AiStreamEvent {
                    event: "error".to_string(),
                    data: Some(format!("Stream error: {}", e)),
                });
                return Err(format!("Stream error: {}", e));
            }
        }
    }

    // 发送完成事件
    let _ = on_event.send(AiStreamEvent {
        event: "done".to_string(),
        data: None,
    });

    Ok(())
}
