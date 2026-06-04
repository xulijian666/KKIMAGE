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

/// 日志工具
export function log(message: string) {
  const timestamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    const logs: string[] = JSON.parse(
      localStorage.getItem("kkimage_logs") || "[]"
    );
    logs.push(line);
    if (logs.length > 200) logs.splice(0, logs.length - 200);
    localStorage.setItem("kkimage_logs", JSON.stringify(logs));
  } catch {}
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
