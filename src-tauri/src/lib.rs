mod db;
mod image_gen;
mod types;

use std::sync::Mutex;
use tauri::{Emitter, Manager};
use types::*;

struct AppState {
    db: Mutex<rusqlite::Connection>,
}

#[tauri::command]
fn get_workspace(state: tauri::State<AppState>) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_generations(state: tauri::State<AppState>) -> Result<Vec<GenerationRecord>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_generations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(
    state: tauri::State<AppState>,
    name: Option<String>,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let project_name = name.unwrap_or_else(|| "新项目".to_string());
    db::create_project(&conn, &project_name).map_err(|e| e.to_string())?;
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_session(
    state: tauri::State<AppState>,
    project_id: String,
    title: Option<String>,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let session_title = title.unwrap_or_else(|| "新会话".to_string());
    db::create_session(&conn, &project_id, &session_title).map_err(|e| e.to_string())?;
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_project(
    state: tauri::State<AppState>,
    id: String,
    name: String,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::rename_project(&conn, &id, &name).map_err(|e| e.to_string())?;
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_project(
    state: tauri::State<AppState>,
    id: String,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let paths = db::delete_project(&conn, &id).map_err(|e| e.to_string())?;
    for path in paths {
        let _ = std::fs::remove_file(path);
    }
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_session(
    state: tauri::State<AppState>,
    id: String,
    title: String,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::rename_session(&conn, &id, &title).map_err(|e| e.to_string())?;
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_session(
    state: tauri::State<AppState>,
    id: String,
) -> Result<WorkspaceSnapshot, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let paths = db::delete_session(&conn, &id).map_err(|e| e.to_string())?;
    for path in paths {
        let _ = std::fs::remove_file(path);
    }
    db::get_workspace(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_generation(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(rec) = db::get_generation(&conn, &id).map_err(|e| e.to_string())? {
        if let Some(ref path) = rec.image_path {
            let _ = std::fs::remove_file(path);
        }
    }

    db::delete_generation(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_generations(state: tauri::State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if let Ok(rows) = db::get_all_generations(&conn) {
        for rec in &rows {
            if let Some(ref path) = rec.image_path {
                let _ = std::fs::remove_file(path);
            }
        }
    }

    db::clear_all_generations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_image(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    request: GenerateRequest,
) -> Result<GenerationRecord, String> {
    let (api_key, base_url) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let key = db::get_setting(&conn, "api_key")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| DEFAULT_API_KEY.to_string());
        let url = db::get_setting(&conn, "base_url")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        (key, url)
    };

    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

    let project_id = request
        .project_id
        .clone()
        .unwrap_or_else(|| DEFAULT_PROJECT_ID.to_string());
    let session_id = request
        .session_id
        .clone()
        .unwrap_or_else(|| DEFAULT_SESSION_ID.to_string());
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let title_seed = request.prompt.chars().take(24).collect::<String>();

    let record = GenerationRecord {
        id: id.clone(),
        project_id: project_id.clone(),
        session_id: session_id.clone(),
        prompt: request.prompt.clone(),
        model: request.model.clone(),
        size: request.size.clone(),
        quality: request.quality.clone(),
        status: "generating".to_string(),
        image_path: None,
        error_message: None,
        created_at: now,
        completed_at: None,
    };

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        db::insert_generation(&conn, &record).map_err(|e| e.to_string())?;
        db::touch_session(&conn, &session_id, Some(&title_seed)).map_err(|e| e.to_string())?;
    }

    let _ = app_handle.emit("generation-started", &record);

    let result = image_gen::generate_image(&api_key, &base_url, &request).await;

    match result {
        Ok((bytes, _revised_prompt)) => {
            let image_path = image_gen::save_image(&id, &bytes)?;

            let conn = state.db.lock().map_err(|e| e.to_string())?;
            db::update_generation_status(&conn, &id, "completed", Some(&image_path), None)
                .map_err(|e| e.to_string())?;
            db::touch_session(&conn, &session_id, None).map_err(|e| e.to_string())?;

            let updated = db::get_generation(&conn, &id)
                .map_err(|e| e.to_string())?
                .unwrap_or(record);
            let _ = app_handle.emit("generation-completed", &updated);

            Ok(updated)
        }
        Err(err_msg) => {
            let conn = state.db.lock().map_err(|e| e.to_string())?;
            db::update_generation_status(&conn, &id, "failed", None, Some(&err_msg))
                .map_err(|e| e.to_string())?;
            db::touch_session(&conn, &session_id, None).map_err(|e| e.to_string())?;

            let updated = db::get_generation(&conn, &id)
                .map_err(|e| e.to_string())?
                .unwrap_or(record);
            let _ = app_handle.emit("generation-failed", &updated);

            Err(err_msg)
        }
    }
}

#[tauri::command]
async fn select_image_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("选择图片")
        .add_filter("图片", &["png", "jpg", "jpeg", "webp"])
        .pick_file()
        .await;

    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
fn open_image_folder(image_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&image_path);
    let dir = path.parent().ok_or("无法获取文件目录")?;
    open::that(dir).map_err(|e| format!("打开文件夹失败: {}", e))
}

#[tauri::command]
async fn save_image_as(image_path: String) -> Result<Option<String>, String> {
    let source = std::path::Path::new(&image_path);
    let extension = source.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let file_name = source
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("kkimage.png");

    let file = rfd::AsyncFileDialog::new()
        .set_title("另存为")
        .set_file_name(file_name)
        .add_filter("图片", &[extension])
        .save_file()
        .await;

    if let Some(file) = file {
        std::fs::copy(source, file.path()).map_err(|e| format!("保存失败: {}", e))?;
        return Ok(Some(file.path().to_string_lossy().to_string()));
    }

    Ok(None)
}

#[tauri::command]
fn save_setting(state: tauri::State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: tauri::State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_settings(state: tauri::State<AppState>) -> Result<Vec<SettingRow>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::get_all_settings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_image_data_url(image_path: String) -> Result<String, String> {
    let bytes = std::fs::read(&image_path).map_err(|e| format!("读取图片失败: {}", e))?;

    let mime = if image_path.ends_with(".jpg") || image_path.ends_with(".jpeg") {
        "image/jpeg"
    } else if image_path.ends_with(".webp") {
        "image/webp"
    } else {
        "image/png"
    };

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
async fn test_api_connection() -> Result<String, String> {
    let conn = db::open_db().map_err(|e| e.to_string())?;
    let api_key = db::get_setting(&conn, "api_key")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_API_KEY.to_string());
    let base_url = db::get_setting(&conn, "base_url")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());

    if api_key.is_empty() {
        return Err("未配置 API Key".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/models", base_url.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;

    if resp.status().is_success() {
        Ok("连接成功".to_string())
    } else {
        Err(format!("API 返回状态 {}", resp.status()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let conn = db::open_db().expect("无法初始化数据库");
            app.manage(AppState {
                db: Mutex::new(conn),
            });

            #[cfg(desktop)]
            {
                use tauri::tray::TrayIconBuilder;
                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("KKIMAGE")
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace,
            get_generations,
            create_project,
            create_session,
            rename_project,
            delete_project,
            rename_session,
            delete_session,
            delete_generation,
            clear_generations,
            generate_image,
            select_image_file,
            open_image_folder,
            save_image_as,
            save_setting,
            get_setting,
            get_all_settings,
            get_image_data_url,
            test_api_connection,
        ])
        .run(tauri::generate_context!())
        .expect("运行 KKIMAGE 应用失败");
}

