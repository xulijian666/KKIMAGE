use crate::types::*;
use base64::Engine;
use reqwest::Client;
use std::path::PathBuf;

pub fn images_dir() -> PathBuf {
    let mut dir = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("KKIMAGE");
    dir.push("images");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub async fn generate_image(
    api_key: &str,
    base_url: &str,
    request: &GenerateRequest,
) -> Result<(Vec<u8>, Option<String>), String> {
    let client = Client::new();

    let base = base_url.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);
    let payload = build_chat_payload(request);

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = resp.status();
    let resp_text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        if let Ok(err_resp) = serde_json::from_str::<OpenAIErrorResponse>(&resp_text) {
            return Err(format!("API 错误: {}", err_resp.error.message));
        }
        return Err(format!("API 返回状态 {}: {}", status, resp_text));
    }

    let chat_resp: ChatCompletionResponse =
        serde_json::from_str(&resp_text).map_err(|e| format!("解析响应失败: {}", e))?;

    extract_image_from_response(&client, &chat_resp).await
}

pub fn build_chat_payload(request: &GenerateRequest) -> serde_json::Value {
    let content = if request.input_images.is_empty() {
        serde_json::Value::String(request.prompt.clone())
    } else {
        let mut parts = vec![serde_json::json!({
            "type": "text",
            "text": request.prompt,
        })];

        parts.extend(request.input_images.iter().map(|image| {
            serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": image,
                },
            })
        }));

        serde_json::Value::Array(parts)
    };

    let mut payload = serde_json::json!({
        "model": request.model,
        "messages": [
            {
                "role": "user",
                "content": content,
            }
        ],
    });

    payload["size"] = if request.size != ImageSize::Auto {
        serde_json::json!(request.size.to_string())
    } else {
        serde_json::json!("2048x2048")
    };

    if request.quality != "auto" {
        payload["quality"] = serde_json::json!(request.quality);
    }

    payload
}

async fn extract_image_from_response(
    client: &Client,
    resp: &ChatCompletionResponse,
) -> Result<(Vec<u8>, Option<String>), String> {
    let mut images: Vec<&ChatImageData> = Vec::new();

    if let Some(ref imgs) = resp.images {
        images.extend(imgs.iter());
    }

    if let Some(ref choices) = resp.choices {
        for choice in choices {
            if let Some(ref msg) = choice.message {
                if let Some(ref imgs) = msg.images {
                    images.extend(imgs.iter());
                }
            }
        }
    }

    for img in &images {
        if let Some(ref b64) = img.b64_json {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("Base64 解码失败: {}", e))?;
            if !bytes.is_empty() {
                return Ok((bytes, img.revised_prompt.clone()));
            }
        }

        if let Some(ref url) = img.url {
            if url.starts_with("data:image") {
                if let Some(b64_part) = url.split(',').nth(1) {
                    let bytes = base64::engine::general_purpose::STANDARD
                        .decode(b64_part.trim())
                        .map_err(|e| format!("Base64 解码失败: {}", e))?;
                    return Ok((bytes, img.revised_prompt.clone()));
                }
            } else {
                let bytes = client
                    .get(url)
                    .send()
                    .await
                    .map_err(|e| format!("下载图片失败: {}", e))?
                    .bytes()
                    .await
                    .map_err(|e| format!("读取图片数据失败: {}", e))?;
                return Ok((bytes.to_vec(), img.revised_prompt.clone()));
            }
        }
    }

    if let Some(ref choices) = resp.choices {
        for choice in choices {
            if let Some(ref msg) = choice.message {
                if let Some(ref content) = msg.content {
                    let text = match content {
                        serde_json::Value::String(s) => s.clone(),
                        serde_json::Value::Array(arr) => arr
                            .iter()
                            .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                            .collect::<Vec<_>>()
                            .join(""),
                        _ => String::new(),
                    };

                    let re = regex::Regex::new(
                        r"!\[[^\]]*\]\((data:image/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+)\)",
                    )
                    .unwrap();

                    if let Some(caps) = re.captures(&text) {
                        let uri = caps.get(1).unwrap().as_str().trim();
                        if let Some(b64_part) = uri.split(',').nth(1) {
                            let bytes = base64::engine::general_purpose::STANDARD
                                .decode(b64_part.trim())
                                .map_err(|e| format!("Base64 解码失败: {}", e))?;
                            return Ok((bytes, None));
                        }
                    }
                }
            }
        }
    }

    Err("响应中未找到图片数据".to_string())
}

pub fn save_image(image_id: &str, bytes: &[u8]) -> Result<String, String> {
    let dir = images_dir();

    let ext = if bytes.len() >= 4 {
        match &bytes[0..4] {
            [0x89, 0x50, 0x4E, 0x47] => "png",
            [0xFF, 0xD8, 0xFF, _] => "jpg",
            [0x52, 0x49, 0x46, 0x46] => "webp",
            _ => "png",
        }
    } else {
        "png"
    };

    let filename = format!("{}.{}", image_id, ext);
    let path = dir.join(&filename);

    std::fs::write(&path, bytes).map_err(|e| format!("保存图片失败: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request_with_images(images: Vec<String>) -> GenerateRequest {
        GenerateRequest {
            prompt: "make it brighter".to_string(),
            model: DEFAULT_MODEL.to_string(),
            size: ImageSize::Square1024,
            quality: "auto".to_string(),
            input_images: images,
            project_id: None,
            session_id: None,
        }
    }

    #[test]
    fn chat_payload_includes_reference_images_when_present() {
        let payload = build_chat_payload(&request_with_images(vec![
            "data:image/png;base64,abc123".to_string(),
        ]));

        let content = &payload["messages"][0]["content"];
        assert!(content.is_array());
        assert_eq!(content[0]["type"], "text");
        assert_eq!(content[0]["text"], "make it brighter");
        assert_eq!(content[1]["type"], "image_url");
        assert_eq!(
            content[1]["image_url"]["url"],
            "data:image/png;base64,abc123"
        );
    }

    #[test]
    fn chat_payload_keeps_plain_text_content_without_images() {
        let payload = build_chat_payload(&request_with_images(Vec::new()));

        assert_eq!(payload["messages"][0]["content"], "make it brighter");
    }
}
