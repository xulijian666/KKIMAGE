import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { THEMES, applyTheme } from "../utils/themes";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  defaultZoom: number;
  onDefaultZoomChange: (zoom: number) => void;
}

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconPlug = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a6 6 0 01-12 0V8z" />
  </svg>
);

const THEME_LABELS: Record<string, string> = {
  "light-premium": "经典白",
  "dark-blue": "深海蓝",
  "dark-purple": "紫夜",
  "dark-zinc": "暗金",
};

export function SettingsModal({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  defaultZoom,
  onDefaultZoomChange,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || "");
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || "https://ai.centos.hk/v1");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "api">("general");

  useEffect(() => {
    if (!isOpen) return;
    invoke<{ key: string; value: string }[]>("get_all_settings")
      .then((settings) => {
        const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
        if (map.api_key) setApiKey(map.api_key);
        if (map.base_url) setBaseUrl(map.base_url);
        if (map.default_zoom) onDefaultZoomChange(Number(map.default_zoom) || 1);
      })
      .catch(() => {});
  }, [isOpen, onDefaultZoomChange]);

  const handleSaveApiKey = async () => {
    await invoke("save_setting", { key: "api_key", value: apiKey });
    await invoke("save_setting", { key: "base_url", value: baseUrl });
  };

  const handleZoomChange = async (value: number) => {
    const zoom = Math.min(3, Math.max(0.25, value));
    onDefaultZoomChange(zoom);
    localStorage.setItem("kkimage_default_zoom", String(zoom));
    await invoke("save_setting", { key: "default_zoom", value: String(zoom) });
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      await handleSaveApiKey();
      const result = await invoke<string>("test_api_connection");
      setTestStatus("success");
      setTestMessage(result);
    } catch (err) {
      setTestStatus("error");
      setTestMessage(String(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="btn-icon" onClick={onClose}>
            <IconX />
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-nav">
            <div
              className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              常规
            </div>
            <div
              className={`settings-nav-item ${activeTab === "api" ? "active" : ""}`}
              onClick={() => setActiveTab("api")}
            >
              API 配置
            </div>
          </div>

          <div className="settings-content">
            {activeTab === "general" && (
              <div className="settings-section">
                <h3>主题</h3>
                <div className="theme-grid">
                  {Object.entries(THEME_LABELS).map(([key, label]) => (
                    <div
                      key={key}
                      className={`theme-card ${currentTheme === key ? "active" : ""}`}
                      onClick={() => {
                        onThemeChange(key);
                        applyTheme(key);
                        localStorage.setItem("kkimage_theme", key);
                      }}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          background: THEMES[key].bgMain,
                          borderColor: THEMES[key].borderColor,
                        }}
                      >
                        <div
                          className="theme-preview-sidebar"
                          style={{ background: THEMES[key].bgSidebar }}
                        />
                        <div className="theme-preview-content">
                          <div
                            className="theme-preview-accent"
                            style={{ background: THEMES[key].colorPrimary }}
                          />
                        </div>
                      </div>
                      <div className="theme-label">
                        {currentTheme === key && <IconCheck />}
                        <span>{label}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="settings-divider" />

                <h3>预览</h3>
                <div className="form-group">
                  <label>默认缩放比例</label>
                  <div className="zoom-setting-row">
                    <input
                      type="range"
                      min="25"
                      max="300"
                      step="5"
                      value={Math.round(defaultZoom * 100)}
                      onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                    />
                    <input
                      className="form-input zoom-number"
                      type="number"
                      min="25"
                      max="300"
                      step="5"
                      value={Math.round(defaultZoom * 100)}
                      onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "api" && (
              <div className="settings-section">
                <h3>
                  <IconPlug /> API 连接
                </h3>
                <p className="settings-hint">
                  配置 OpenAI 兼容的图片生成 API。模型固定为 gpt-image-2。
                </p>

                <div className="form-group">
                  <label>API Base URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://ai.centos.hk/v1"
                  />
                </div>

                <div className="form-group">
                  <label>API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="留空则使用默认 Key"
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-primary" onClick={handleSaveApiKey}>
                    保存
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing"}
                  >
                    {testStatus === "testing" ? "测试中..." : "测试连接"}
                  </button>
                </div>

                {testMessage && <div className={`test-result ${testStatus}`}>{testMessage}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
