import type { ReviewResult, ReviewFormData, RewriteField } from "../types/review";
import { FIELD_LABELS } from "../types/review";

interface ReviewResultViewProps {
  result: ReviewResult;
  formData: ReviewFormData;
  onApplyRewrite: (field: RewriteField, suggested: string) => void;
}

export function ReviewResultView({
  result,
  formData,
  onApplyRewrite,
}: ReviewResultViewProps) {
  const isOk = result.status === "ok";

  return (
    <div className="space-y-4">
      {/* Status badge + summary */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          isOk
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <span
          className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            isOk
              ? "bg-green-200 text-green-800"
              : "bg-amber-200 text-amber-800"
          }`}
        >
          {isOk ? "OK" : "!"}
        </span>
        <p className="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
      </div>

      {/* Comments */}
      {result.comments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            指摘事項
          </h3>
          <ul className="space-y-1.5">
            {result.comments.map((comment, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>{comment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rewrite suggestions */}
      {result.rewrites.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            書き替え提案
          </h3>
          {result.rewrites.map((rw, i) => {
            const currentValue = formData[rw.field] || "";
            return (
              <div
                key={i}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    {FIELD_LABELS[rw.field]}
                  </span>
                  <button
                    onClick={() => onApplyRewrite(rw.field, rw.suggested)}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    適用
                  </button>
                </div>

                {/* Diff-like view */}
                <div className="p-4 space-y-2">
                  {currentValue && (
                    <div>
                      <span className="text-xs text-red-500 font-mono">- 現在</span>
                      <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 mt-1 whitespace-pre-wrap">
                        {currentValue}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-green-600 font-mono">+ 提案</span>
                    <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2 mt-1 whitespace-pre-wrap">
                      {rw.suggested}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All clear */}
      {isOk && result.rewrites.length === 0 && result.comments.length === 0 && (
        <p className="text-sm text-green-700 text-center py-4">
          問題は見つかりませんでした。
        </p>
      )}
    </div>
  );
}
