import { useState } from "react";
import type { AoaiSettings } from "../hooks/useAoaiSettings";

interface SettingsPanelProps {
  settings: AoaiSettings;
  onUpdate: (partial: Partial<AoaiSettings>) => void;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  onUpdate,
  onClose,
}: SettingsPanelProps) {
  const [local, setLocal] = useState<AoaiSettings>({ ...settings });

  const handleSave = () => {
    onUpdate(local);
    onClose();
  };

  const handleClear = () => {
    const cleared: AoaiSettings = {
      endpoint: "",
      apiKey: "",
      deployment: "gpt-4o",
      apiVersion: "2024-12-01-preview",
    };
    setLocal(cleared);
    onUpdate(cleared);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            Azure OpenAI 設定
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            クライアントサイドで AOAI の接続情報を設定します。
            未設定の場合はサーバー側の環境変数が使用されます。
            設定値はブラウザの localStorage に保存されます。
          </p>

          <Field
            label="Endpoint"
            placeholder="https://your-resource.openai.azure.com/"
            value={local.endpoint}
            onChange={(v) => setLocal((p) => ({ ...p, endpoint: v }))}
          />

          <Field
            label="API Key"
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={local.apiKey}
            onChange={(v) => setLocal((p) => ({ ...p, apiKey: v }))}
            type="password"
          />

          <Field
            label="Deployment Name"
            placeholder="gpt-4o"
            value={local.deployment}
            onChange={(v) => setLocal((p) => ({ ...p, deployment: v }))}
          />

          <Field
            label="API Version"
            placeholder="2024-12-01-preview"
            value={local.apiVersion}
            onChange={(v) => setLocal((p) => ({ ...p, apiVersion: v }))}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            クリア
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Internal ──

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
      />
    </div>
  );
}
