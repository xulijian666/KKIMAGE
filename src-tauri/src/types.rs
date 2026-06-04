use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ImageSize {
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "1024x1024")]
    Square1024,
    #[serde(rename = "1536x1024")]
    Landscape1536,
    #[serde(rename = "1024x1536")]
    Portrait1536,
    #[serde(rename = "2048x2048")]
    Square2048,
    #[serde(rename = "3840x2160")]
    UHD4K,
}

pub const DEFAULT_BASE_URL: &str = "https://ai.centos.hk/v1";
pub const DEFAULT_API_KEY: &str = ""; // 请通过环境变量或设置界面配置API密钥
pub const DEFAULT_MODEL: &str = "gpt-image-2";
pub const DEFAULT_PROJECT_ID: &str = "default-project";
pub const DEFAULT_SESSION_ID: &str = "default-session";

impl fmt::Display for ImageSize {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ImageSize::Auto => write!(f, "auto"),
            ImageSize::Square1024 => write!(f, "1024x1024"),
            ImageSize::Landscape1536 => write!(f, "1536x1024"),
            ImageSize::Portrait1536 => write!(f, "1024x1536"),
            ImageSize::Square2048 => write!(f, "2048x2048"),
            ImageSize::UHD4K => write!(f, "3840x2160"),
        }
    }
}

impl FromStr for ImageSize {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "auto" => Ok(ImageSize::Auto),
            "1024x1024" => Ok(ImageSize::Square1024),
            "1536x1024" => Ok(ImageSize::Landscape1536),
            "1024x1536" => Ok(ImageSize::Portrait1536),
            "2048x2048" => Ok(ImageSize::Square2048),
            "3840x2160" => Ok(ImageSize::UHD4K),
            _ => Err(format!("Unknown size: {}", s)),
        }
    }
}

impl Default for ImageSize {
    fn default() -> Self {
        ImageSize::Square1024
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationRecord {
    pub id: String,
    pub project_id: String,
    pub session_id: String,
    pub prompt: String,
    pub model: String,
    pub size: ImageSize,
    pub quality: String,
    pub status: String,
    pub image_path: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub projects: Vec<ProjectRecord>,
    pub sessions: Vec<SessionRecord>,
    pub generations: Vec<GenerationRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub size: ImageSize,
    #[serde(default = "default_quality")]
    pub quality: String,
    #[serde(default)]
    pub input_images: Vec<String>,
    pub project_id: Option<String>,
    pub session_id: Option<String>,
}

fn default_model() -> String {
    DEFAULT_MODEL.to_string()
}

fn default_quality() -> String {
    "auto".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: Option<String>,
    pub model: Option<String>,
    pub choices: Option<Vec<ChatChoice>>,
    pub images: Option<Vec<ChatImageData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub message: Option<ChatMessage>,
    pub index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
    pub images: Option<Vec<ChatImageData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatImageData {
    pub url: Option<String>,
    pub b64_json: Option<String>,
    pub revised_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIErrorResponse {
    pub error: OpenAIError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIError {
    pub message: String,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub code: Option<String>,
}
