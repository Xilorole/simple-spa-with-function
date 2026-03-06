"""AI レビュー出力スキーマ (Pydantic v2)."""

from typing import Literal

from pydantic import BaseModel, Field

RewriteField = Literal["gap", "process", "criteria3", "criteria4", "criteria5"]


class RewriteSuggestion(BaseModel):
    field: RewriteField = Field(description="書き替え対象のフィールド名")
    suggested: str = Field(
        description="改善後の記述。コメントではなく、そのままユーザーの記述として記載できるように。"
    )


class ReviewResult(BaseModel):
    """Azure OpenAI structured output のスキーマ。"""

    status: Literal["ok", "has_issues"] = Field(
        description="問題なしなら ok、指摘ありなら has_issues"
    )
    summary: str = Field(description="レビュー結果の概要（1文）")
    comments: list[str] = Field(description="指摘事項のリスト。okの場合は空配列。")
    rewrites: list[RewriteSuggestion] = Field(
        description="書き替え提案のリスト。okの場合は空配列。"
    )
