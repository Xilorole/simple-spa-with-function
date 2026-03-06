/**
 * Partial JSON parser.
 *
 * OpenAI の structured output は JSON を先頭から順に生成する:
 *   {"summary":"応答の要約","emotions":["感情A","感情B"],"content":"本文..."}
 *
 * ストリーミング中の断片に対して、未閉じの ", ], } を末尾に補完して
 * JSON.parse を試みる。パースできた部分を StructuredChat として返す。
 */

import type { StructuredChat } from "../components/MessageBubble";

/**
 * 未閉じの JSON 文字列を補完してパースを試みる。
 * 失敗したら null。
 */
export function parsePartialJson(raw: string): unknown | null {
  if (!raw.trim()) return null;

  // スタックで未閉じの構造を追跡
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (const ch of raw) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }

    switch (ch) {
      case '"':
        inString = true;
        closers.push('"');
        break;
      case "{":
        closers.push("}");
        break;
      case "[":
        closers.push("]");
        break;
      case "}":
      case "]":
        // Pop matching closer
        if (closers.length > 0 && closers[closers.length - 1] === ch) {
          closers.pop();
        }
        break;
    }
  }

  // 末尾に閉じ文字を逆順に追加
  const suffix = closers.reverse().join("");
  const completed = raw + suffix;

  try {
    return JSON.parse(completed);
  } catch {
    // 途中で値が不完全な場合（例: {"summary":"途中 → {"summary":"途中"} ）
    // もう少し積極的に補完を試みる
    return tryRepairAndParse(raw, closers);
  }
}

/**
 * 基本補完でダメだった場合のフォールバック。
 * 末尾の不完全な値を切り落としてパースを試みる。
 */
function tryRepairAndParse(raw: string, _closers: string[]): unknown | null {
  // 末尾から少しずつ削って、補完→パースを試みる
  // 最大 50 文字分だけ戻る（それ以上はコストに見合わない）
  const maxBacktrack = Math.min(50, raw.length);

  for (let i = 0; i < maxBacktrack; i++) {
    const truncated = raw.slice(0, raw.length - i);
    if (!truncated) break;

    // 再度スタック構築
    const closers2: string[] = [];
    let inStr = false;
    let esc = false;

    for (const ch of truncated) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (inStr) { if (ch === '"') inStr = false; continue; }
      switch (ch) {
        case '"': inStr = true; closers2.push('"'); break;
        case "{": closers2.push("}"); break;
        case "[": closers2.push("]"); break;
        case "}": case "]":
          if (closers2.length > 0 && closers2[closers2.length - 1] === ch) closers2.pop();
          break;
      }
    }

    const suffix2 = closers2.reverse().join("");
    try {
      return JSON.parse(truncated + suffix2);
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * partial JSON → StructuredChat へのマッピング。
 * パース可能なフィールドだけ取り出す。
 */
export function parsePartialStructured(raw: string): Partial<StructuredChat> | null {
  const obj = parsePartialJson(raw);
  if (!obj || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;
  const result: Partial<StructuredChat> = {};

  if (typeof record.summary === "string") {
    result.summary = record.summary;
  }
  if (Array.isArray(record.emotions)) {
    result.emotions = record.emotions.filter(
      (e): e is string => typeof e === "string"
    );
  }
  if (typeof record.content === "string") {
    result.content = record.content;
  }

  return Object.keys(result).length > 0 ? result : null;
}
