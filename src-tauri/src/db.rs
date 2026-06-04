use rusqlite::{Connection, Result as SqlResult};
use std::fs;
use std::path::PathBuf;

use crate::types::{
    GenerationRecord, ImageSize, ProjectRecord, SessionRecord, SettingRow, WorkspaceSnapshot,
    DEFAULT_PROJECT_ID, DEFAULT_SESSION_ID,
};

pub fn db_path() -> PathBuf {
    let mut dir = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("KKIMAGE");
    fs::create_dir_all(&dir).ok();
    dir.push("kkimage.db");
    dir
}

pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS project (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS session (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS generation (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL DEFAULT 'default-project',
            session_id TEXT NOT NULL DEFAULT 'default-session',
            prompt TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'gpt-image-1',
            size TEXT NOT NULL DEFAULT '1024x1024',
            quality TEXT NOT NULL DEFAULT 'auto',
            status TEXT NOT NULL DEFAULT 'pending',
            image_path TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )?;

    add_column_if_missing(
        conn,
        "generation",
        "project_id",
        "TEXT NOT NULL DEFAULT 'default-project'",
    )?;
    add_column_if_missing(
        conn,
        "generation",
        "session_id",
        "TEXT NOT NULL DEFAULT 'default-session'",
    )?;

    ensure_default_workspace(conn)?;
    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> SqlResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column {
            return Ok(());
        }
    }

    conn.execute(
        &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition),
        [],
    )?;
    Ok(())
}

fn ensure_default_workspace(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO project (id, name, created_at)
         VALUES (?1, 'GPT2Image-Pro', datetime('now'))",
        [DEFAULT_PROJECT_ID],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO session (id, project_id, title, created_at, updated_at)
         VALUES (?1, ?2, 'AI生图', datetime('now'), datetime('now'))",
        [DEFAULT_SESSION_ID, DEFAULT_PROJECT_ID],
    )?;
    conn.execute(
        "UPDATE generation
         SET project_id = COALESCE(NULLIF(project_id, ''), ?1),
             session_id = COALESCE(NULLIF(session_id, ''), ?2)",
        [DEFAULT_PROJECT_ID, DEFAULT_SESSION_ID],
    )?;
    Ok(())
}

pub fn open_db() -> SqlResult<Connection> {
    let path = db_path();
    let conn = Connection::open(path)?;
    init_db(&conn)?;
    Ok(conn)
}

pub fn create_project(conn: &Connection, name: &str) -> SqlResult<(ProjectRecord, SessionRecord)> {
    let project_id = uuid::Uuid::new_v4().to_string();
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO project (id, name, created_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![project_id, name, now],
    )?;
    conn.execute(
        "INSERT INTO session (id, project_id, title, created_at, updated_at)
         VALUES (?1, ?2, '新会话', ?3, ?3)",
        rusqlite::params![session_id, project_id, now],
    )?;

    Ok((
        ProjectRecord {
            id: project_id.clone(),
            name: name.to_string(),
            created_at: now.clone(),
        },
        SessionRecord {
            id: session_id,
            project_id,
            title: "新会话".to_string(),
            created_at: now.clone(),
            updated_at: now,
        },
    ))
}

pub fn create_session(conn: &Connection, project_id: &str, title: &str) -> SqlResult<SessionRecord> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO session (id, project_id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![id, project_id, title, now],
    )?;

    Ok(SessionRecord {
        id,
        project_id: project_id.to_string(),
        title: title.to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn touch_session(conn: &Connection, session_id: &str, title: Option<&str>) -> SqlResult<()> {
    if let Some(title) = title {
        conn.execute(
            "UPDATE session
             SET title = CASE WHEN title IN ('新会话', 'AI生图') THEN ?1 ELSE title END,
                 updated_at = datetime('now')
             WHERE id = ?2",
            rusqlite::params![title, session_id],
        )?;
    } else {
        conn.execute(
            "UPDATE session SET updated_at = datetime('now') WHERE id = ?1",
            [session_id],
        )?;
    }
    Ok(())
}

pub fn insert_generation(conn: &Connection, rec: &GenerationRecord) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO generation (
            id, project_id, session_id, prompt, model, size, quality, status,
            image_path, error_message, created_at, completed_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            rec.id,
            rec.project_id,
            rec.session_id,
            rec.prompt,
            rec.model,
            rec.size.to_string(),
            rec.quality,
            rec.status,
            rec.image_path,
            rec.error_message,
            rec.created_at,
            rec.completed_at,
        ],
    )?;
    Ok(())
}

pub fn update_generation_status(
    conn: &Connection,
    id: &str,
    status: &str,
    image_path: Option<&str>,
    error_message: Option<&str>,
) -> SqlResult<()> {
    conn.execute(
        "UPDATE generation
         SET status = ?1,
             image_path = COALESCE(?2, image_path),
             error_message = ?3,
             completed_at = CASE WHEN ?1 IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
         WHERE id = ?4",
        rusqlite::params![status, image_path, error_message, id],
    )?;
    Ok(())
}

pub fn get_all_generations(conn: &Connection) -> SqlResult<Vec<GenerationRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, session_id, prompt, model, size, quality, status,
                image_path, error_message, created_at, completed_at
         FROM generation
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], generation_from_row)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn get_generation(conn: &Connection, id: &str) -> SqlResult<Option<GenerationRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, session_id, prompt, model, size, quality, status,
                image_path, error_message, created_at, completed_at
         FROM generation WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map([id], generation_from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

fn generation_from_row(row: &rusqlite::Row<'_>) -> SqlResult<GenerationRecord> {
    Ok(GenerationRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        session_id: row.get(2)?,
        prompt: row.get(3)?,
        model: row.get(4)?,
        size: row.get::<_, String>(5)?.parse().unwrap_or(ImageSize::Square1024),
        quality: row.get(6)?,
        status: row.get(7)?,
        image_path: row.get(8)?,
        error_message: row.get(9)?,
        created_at: row.get(10)?,
        completed_at: row.get(11)?,
    })
}

pub fn get_projects(conn: &Connection) -> SqlResult<Vec<ProjectRecord>> {
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM project ORDER BY created_at ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(ProjectRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn get_sessions(conn: &Connection) -> SqlResult<Vec<SessionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, created_at, updated_at
         FROM session
         ORDER BY updated_at DESC, created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SessionRecord {
            id: row.get(0)?,
            project_id: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

pub fn get_workspace(conn: &Connection) -> SqlResult<WorkspaceSnapshot> {
    Ok(WorkspaceSnapshot {
        projects: get_projects(conn)?,
        sessions: get_sessions(conn)?,
        generations: get_all_generations(conn)?,
    })
}

pub fn delete_generation(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM generation WHERE id = ?1", [id])?;
    Ok(())
}

pub fn clear_all_generations(conn: &Connection) -> SqlResult<()> {
    conn.execute("DELETE FROM generation", [])?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> SqlResult<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map([key], |row| row.get::<_, String>(0))?;
    match rows.next() {
        Some(Ok(val)) => Ok(Some(val)),
        _ => Ok(None),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> SqlResult<Vec<SettingRow>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok(SettingRow {
            key: row.get(0)?,
            value: row.get(1)?,
        })
    })?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
