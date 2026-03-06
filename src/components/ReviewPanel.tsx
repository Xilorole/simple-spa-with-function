import { useState, useCallback } from "react";
import type { AoaiSettings } from "../hooks/useAoaiSettings";
import { useReviewPolling } from "../hooks/useReviewPolling";
import { ReviewResultView } from "./ReviewResultView";
import type { ReviewFormData, RewriteField } from "../types/review";
import { FIELD_LABELS, createEmptyForm } from "../types/review";

interface ReviewPanelProps {
  settings: AoaiSettings;
}

const FIELD_KEYS: RewriteField[] = [
  "gap",
  "process",
  "criteria3",
  "criteria4",
  "criteria5",
];

export function ReviewPanel({ settings }: ReviewPanelProps) {
  const [formData, setFormData] = useState<ReviewFormData>(createEmptyForm);
  const { state, submitReview, reset } = useReviewPolling(settings);

  const handleChange = useCallback(
    (field: RewriteField, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitReview(formData);
  };

  const handleApplyRewrite = useCallback(
    (field: RewriteField, suggested: string) => {
      setFormData((prev) => ({ ...prev, [field]: suggested }));
    },
    []
  );

  const handleReset = () => {
    reset();
  };

  const isLoading = state.phase === "loading";

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">
            📋 目標設定レビュー
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            構造化出力 + ポーリング (adaptive interval)
          </p>
        </div>
        {state.phase !== "idle" && (
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            リセット
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELD_KEYS.map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {FIELD_LABELS[key]}
              </label>
              <textarea
                value={formData[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={isLoading}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={`${FIELD_LABELS[key]} を入力...`}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={
              isLoading || FIELD_KEYS.every((k) => !formData[k].trim())
            }
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "レビュー中..." : "AI レビューを実行"}
          </button>
        </form>

        {/* Streaming indicator */}
        {state.phase === "loading" && state.rawText && (
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-gray-500">生成中...</span>
            </div>
            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {state.rawText}
            </pre>
          </div>
        )}

        {state.phase === "loading" && !state.rawText && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>AI がレビューを準備しています...</span>
          </div>
        )}

        {/* Error */}
        {state.phase === "error" && (
          <div className="border border-red-200 rounded-xl p-4 bg-red-50">
            <p className="text-sm text-red-700">⚠️ {state.message}</p>
          </div>
        )}

        {/* Result */}
        {state.phase === "done" && (
          <ReviewResultView
            result={state.result}
            formData={formData}
            onApplyRewrite={handleApplyRewrite}
          />
        )}
      </div>
    </div>
  );
}
