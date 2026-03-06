/** 書き替え対象フィールド名 */
export type RewriteField =
  | "gap"
  | "process"
  | "criteria3"
  | "criteria4"
  | "criteria5";

export interface RewriteSuggestion {
  field: RewriteField;
  suggested: string;
}

export interface ReviewResult {
  status: "ok" | "has_issues";
  summary: string;
  comments: string[];
  rewrites: RewriteSuggestion[];
}

/** フィールド名の日本語ラベル */
export const FIELD_LABELS: Record<RewriteField, string> = {
  gap: "ギャップ",
  process: "プロセス",
  criteria3: "達成基準 3",
  criteria4: "達成基準 4",
  criteria5: "達成基準 5",
};

/** review form に入力するデータ */
export interface ReviewFormData {
  gap: string;
  process: string;
  criteria3: string;
  criteria4: string;
  criteria5: string;
}

const EMPTY_FORM: ReviewFormData = {
  gap: "",
  process: "",
  criteria3: "",
  criteria4: "",
  criteria5: "",
};

export function createEmptyForm(): ReviewFormData {
  return { ...EMPTY_FORM };
}

/**
 * 文字列が ReviewResult JSON かどうか試みてパースする。
 * 失敗したら null を返す。
 */
export function tryParseReviewResult(text: string): ReviewResult | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj === "object" &&
      ("status" in obj) &&
      ("summary" in obj) &&
      ("comments" in obj) &&
      ("rewrites" in obj)
    ) {
      return obj as ReviewResult;
    }
    return null;
  } catch {
    return null;
  }
}
