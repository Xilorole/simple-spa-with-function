import json
import os
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum

import azure.functions as func
from openai import AzureOpenAI
from pydantic import BaseModel, Field

app = func.FunctionApp()


# ──────────────────────────────────────────────
# Structured output schema for chat
# ──────────────────────────────────────────────


class StructuredChatResponse(BaseModel):
    """チャット応答の構造化出力スキーマ。"""

    summary: str = Field(description="応答の要約（1文）")
    emotions: list[str] = Field(description="応答に関連する感情タグのリスト")
    content: str = Field(description="実際の応答本文（Markdown対応）")


def _build_strict_schema(model: type[BaseModel]) -> dict:
    """Generate a JSON schema compatible with OpenAI strict mode.

    OpenAI requires `additionalProperties: false` on every object,
    which Pydantic doesn't emit by default.
    """
    schema = model.model_json_schema()
    schema["additionalProperties"] = False
    # Also patch any nested $defs if present
    for defn in schema.get("$defs", {}).values():
        if defn.get("type") == "object":
            defn["additionalProperties"] = False
    return schema


_STRUCTURED_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "StructuredChatResponse",
        "strict": True,
        "schema": _build_strict_schema(StructuredChatResponse),
    },
}


# ──────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────


@dataclass(frozen=True)
class AoaiOverride:
    """Client-supplied AOAI connection settings (optional override)."""

    endpoint: str = ""
    api_key: str = ""
    deployment: str = ""
    api_version: str = ""


def _get_openai_client(
    override: AoaiOverride | None = None,
) -> tuple[AzureOpenAI, str]:
    """Return (client, deployment) or raise ValueError.

    If *override* has non-empty values they take priority over env vars.
    """
    endpoint = (override and override.endpoint) or os.environ.get(
        "AZURE_OPENAI_ENDPOINT", ""
    )
    api_key = (override and override.api_key) or os.environ.get(
        "AZURE_OPENAI_API_KEY", ""
    )
    deployment = (
        (override and override.deployment)
        or os.environ.get("AZURE_OPENAI_DEPLOYMENT")
        or "gpt-4o"
    )
    api_version = (
        (override and override.api_version)
        or os.environ.get("AZURE_OPENAI_API_VERSION")
        or "2024-12-01-preview"
    )

    missing = [
        name
        for name, val in [
            ("endpoint", endpoint),
            ("api_key", api_key),
        ]
        if not val
    ]
    if missing:
        raise ValueError(
            f"AOAI設定エラー: {', '.join(missing)} が未設定です。"
            " 画面右上の設定ボタンか、サーバー環境変数で設定してください。"
        )

    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )
    return client, deployment


def _get_user_info(req: func.HttpRequest) -> dict | None:
    """Extract user info from SWA auth header."""
    header = req.headers.get("x-ms-client-principal")
    if not header:
        return None
    import base64

    try:
        decoded = base64.b64decode(header)
        return json.loads(decoded)
    except Exception:
        return None


def _parse_messages(
    req: func.HttpRequest,
) -> tuple[list[dict], AoaiOverride | None, bool]:
    """Parse messages, optional AOAI override, and structured flag."""
    try:
        body = req.get_json()
    except ValueError:
        raise ValueError("リクエストのJSON形式が不正です")

    messages = body.get("messages", [])
    if not messages:
        raise ValueError("messages フィールドは必須です")

    override: AoaiOverride | None = None
    raw = body.get("aoai_settings")
    if raw and isinstance(raw, dict):
        override = AoaiOverride(
            endpoint=raw.get("endpoint", ""),
            api_key=raw.get("apiKey", ""),
            deployment=raw.get("deployment", ""),
            api_version=raw.get("apiVersion", ""),
        )

    structured: bool = body.get("structured", False)
    return messages, override, structured


def _error_response(msg: str, status_code: int = 400) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": msg}),
        status_code=status_code,
        mimetype="application/json",
    )


# ──────────────────────────────────────────────
# 1. Original non-streaming endpoint (kept as-is)
# ──────────────────────────────────────────────


@app.route(route="chat", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """Chat API endpoint that proxies requests to Azure OpenAI."""
    user_info = _get_user_info(req)
    user_name = user_info.get("userDetails", "unknown") if user_info else "anonymous"
    logging.info(f"Chat API called by user: {user_name}")

    try:
        messages, override, structured = _parse_messages(req)
    except ValueError as e:
        return _error_response(str(e), 400)

    try:
        client, deployment = _get_openai_client(override)
        response = client.chat.completions.create(
            model=deployment,
            messages=messages,
            max_completion_tokens=1024,
        )
        reply = response.choices[0].message.content
        return func.HttpResponse(
            json.dumps({"reply": reply}),
            status_code=200,
            mimetype="application/json",
        )
    except ValueError as e:
        return _error_response(str(e), 500)
    except Exception as e:
        logging.error(f"Error calling Azure OpenAI: {type(e).__name__}: {e}")
        return _error_response(f"AI応答エラー: {type(e).__name__}: {e}", 500)


# ──────────────────────────────────────────────
# 2. SSE Streaming endpoint
#    NOTE: Azure Functions Python v2 does NOT support true streaming
#    (func.HttpResponse cannot accept a generator).
#    This endpoint collects all SSE frames and returns them at once.
#    The *format* is SSE-compliant so the frontend EventSource/fetch
#    logic works identically once moved to BYOF + FastAPI/ASGI.
# ──────────────────────────────────────────────


@app.route(route="chat/stream", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat_stream(req: func.HttpRequest) -> func.HttpResponse:
    """SSE streaming endpoint (buffered in managed functions)."""
    user_info = _get_user_info(req)
    user_name = user_info.get("userDetails", "unknown") if user_info else "anonymous"
    logging.info(f"Chat Stream API called by user: {user_name}")

    try:
        messages, override, structured = _parse_messages(req)
    except ValueError as e:
        return _error_response(str(e), 400)

    try:
        client, deployment = _get_openai_client(override)
    except ValueError as e:
        return _error_response(str(e), 500)

    try:
        stream = client.chat.completions.create(
            model=deployment,
            messages=messages,
            max_completion_tokens=1024,
            stream=True,
        )
        frames: list[str] = []
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                data = json.dumps({"content": content}, ensure_ascii=False)
                frames.append(f"data: {data}\n\n")
        frames.append("data: [DONE]\n\n")
        body = "".join(frames)
    except Exception as e:
        logging.error(f"Stream error: {type(e).__name__}: {e}")
        error_data = json.dumps(
            {"error": f"{type(e).__name__}: {e}"}, ensure_ascii=False
        )
        body = f"data: {error_data}\n\ndata: [DONE]\n\n"

    return func.HttpResponse(
        body,
        status_code=200,
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────
# 3. Polling-based pseudo-streaming
#    POST /api/chat/start       → { job_id }
#    GET  /api/chat/poll?job_id=xxx&cursor=0
#                               → { content, cursor, status, error? }
#
#    Frontend polls every ~500ms, gets delta text since last cursor.
#    This works on ANY hosting plan (Consumption, SWA Managed, etc.)
# ──────────────────────────────────────────────


class JobStatus(str, Enum):
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass
class StreamingJob:
    """Accumulates OpenAI stream chunks in a background thread."""

    job_id: str
    chunks: list[str] = field(default_factory=list)
    status: JobStatus = JobStatus.RUNNING
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    lock: threading.Lock = field(default_factory=threading.Lock)


# In-memory job store.
# Production: use Redis / Cosmos DB / Durable Entities.
_job_store: dict[str, StreamingJob] = {}
_store_lock = threading.Lock()

_JOB_TTL_SECONDS = 300


def _cleanup_old_jobs() -> None:
    """Evict jobs older than TTL."""
    now = time.time()
    with _store_lock:
        expired = [
            jid
            for jid, job in _job_store.items()
            if now - job.created_at > _JOB_TTL_SECONDS
        ]
        for jid in expired:
            del _job_store[jid]


def _run_streaming_job(
    job: StreamingJob,
    messages: list[dict],
    override: AoaiOverride | None = None,
    structured: bool = False,
) -> None:
    """Background thread: stream from OpenAI and accumulate chunks."""
    try:
        client, deployment = _get_openai_client(override)

        kwargs: dict = {
            "model": deployment,
            "messages": messages,
            "max_completion_tokens": 1024,
            "stream": True,
        }
        if structured:
            kwargs["response_format"] = _STRUCTURED_JSON_SCHEMA

        stream = client.chat.completions.create(**kwargs)
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                with job.lock:
                    job.chunks.append(content)

        with job.lock:
            job.status = JobStatus.DONE

    except Exception as e:
        logging.error(f"Job {job.job_id} error: {type(e).__name__}: {e}")
        with job.lock:
            job.status = JobStatus.ERROR
            job.error = f"{type(e).__name__}: {e}"


@app.route(route="chat/start", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat_start(req: func.HttpRequest) -> func.HttpResponse:
    """Start a streaming job and return the job_id immediately."""
    _cleanup_old_jobs()

    user_info = _get_user_info(req)
    user_name = user_info.get("userDetails", "unknown") if user_info else "anonymous"
    logging.info(f"Chat Start (polling) called by user: {user_name}")

    try:
        messages, override, structured = _parse_messages(req)
    except ValueError as e:
        return _error_response(str(e), 400)

    try:
        _get_openai_client(override)  # validate before spawning thread
    except ValueError as e:
        return _error_response(str(e), 500)

    job_id = str(uuid.uuid4())
    job = StreamingJob(job_id=job_id)

    with _store_lock:
        _job_store[job_id] = job

    thread = threading.Thread(
        target=_run_streaming_job,
        args=(job, messages, override, structured),
        daemon=True,
    )
    thread.start()

    return func.HttpResponse(
        json.dumps({"job_id": job_id}),
        status_code=202,
        mimetype="application/json",
    )


@app.route(route="chat/poll", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def chat_poll(req: func.HttpRequest) -> func.HttpResponse:
    """Poll a streaming job. Returns new content since the given cursor."""
    job_id = req.params.get("job_id")
    if not job_id:
        return _error_response("job_id パラメータが必要です", 400)

    cursor_str = req.params.get("cursor", "0")
    try:
        cursor = int(cursor_str)
    except ValueError:
        return _error_response("cursor は整数で指定してください", 400)

    with _store_lock:
        job = _job_store.get(job_id)

    if not job:
        return _error_response(f"ジョブが見つかりません: {job_id}", 404)

    with job.lock:
        new_chunks = job.chunks[cursor:]
        new_cursor = len(job.chunks)
        status = job.status
        error = job.error

    result: dict[str, str | int] = {
        "content": "".join(new_chunks),
        "cursor": new_cursor,
        "status": status.value,
    }
    if error:
        result["error"] = error

    return func.HttpResponse(
        json.dumps(result, ensure_ascii=False),
        status_code=200,
        mimetype="application/json",
    )


