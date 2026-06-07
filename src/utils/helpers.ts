/// 生成 UUID v4
export function uuidv4(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const isDev = import.meta.env.DEV;

/// 日志工具
export function log(message: string) {
  const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false, fractionalSecondDigits: 3 } as any);
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    const logs: string[] = JSON.parse(
      localStorage.getItem("kkimage_logs") || "[]"
    );
    logs.push(line);
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    localStorage.setItem("kkimage_logs", JSON.stringify(logs));
  } catch {}
  // Also write to file in dev mode
  if (isDev) {
    flushLogToFile(line);
  }
}

/// 调试日志（开发模式详细输出）

// Log buffer for batched file writes
let _logBuffer: string[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushLogToFile(line: string) {
  _logBuffer.push(line);
  // Flush immediately if buffer is large, otherwise debounce
  if (_logBuffer.length >= 5) {
    doFlush();
  } else if (!_flushTimer) {
    _flushTimer = setTimeout(doFlush, 500);
  }
}

function doFlush() {
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
  if (_logBuffer.length === 0) return;
  const batch = _logBuffer.join("\n");
  _logBuffer = [];
  // Fire-and-forget invoke to write to file
  import("@tauri-apps/api/core").then(({ invoke }) => {
    invoke("append_log", { message: batch }).catch(() => {});
  }).catch(() => {});
}

export function debugLog(tag: string, message: string, data?: any) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${tag}] ${message}`;
  console.log(line, data !== undefined ? data : "");
  try {
    const logs: string[] = JSON.parse(
      localStorage.getItem("kkimage_debug_logs") || "[]"
    );
    const entry = data !== undefined ? `${line} ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 500)}` : line;
    logs.push(entry);
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);
    localStorage.setItem("kkimage_debug_logs", JSON.stringify(logs));
  } catch {}
  // Write to file in dev mode
  if (isDev) {
    const fileEntry = data !== undefined
      ? `${line} ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 500)}`
      : line;
    flushLogToFile(fileEntry);
  }
}

/// Flush all pending logs to file (call before critical operations)
export function flushLogs() {
  doFlush();
}

/// 导出日志到文件（通过浏览器下载）
export function exportLogsToFile() {
  try {
    const debugLogs: string[] = JSON.parse(localStorage.getItem("kkimage_debug_logs") || "[]");
    const normalLogs: string[] = JSON.parse(localStorage.getItem("kkimage_logs") || "[]");
    const allLogs = [...normalLogs, "========== DEBUG LOGS ==========", ...debugLogs];
    const content = allLogs.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kkimage_debug_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("导出日志失败:", e);
  }
}

/// 获取日志文件路径（打印在控制台供用户查看）
export function getLogFilePath(): string {
  // On Windows: C:\Users\<user>\AppData\Roaming\KKIMAGE\debug.log
  return "%APPDATA%\\KKIMAGE\\debug.log";
}

/// 格式化时间
export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString.replace(" ", "T") + "Z");
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/// 截断文本
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
