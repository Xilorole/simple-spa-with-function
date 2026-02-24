import json
import os
import logging

import azure.functions as func
from openai import AzureOpenAI

app = func.FunctionApp()


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


@app.route(route="chat", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """Chat API endpoint that proxies requests to Azure OpenAI."""
    user_info = _get_user_info(req)
    user_name = user_info.get("userDetails", "unknown") if user_info else "anonymous"
    logging.info(f"Chat API called by user: {user_name}")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "リクエストのJSON形式が不正です"}),
            status_code=400,
            mimetype="application/json",
        )

    messages = body.get("messages", [])
    if not messages:
        return func.HttpResponse(
            json.dumps({"error": "messages フィールドは必須です"}),
            status_code=400,
            mimetype="application/json",
        )

    # Check required environment variables upfront
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not endpoint or not api_key:
        missing = []
        if not endpoint:
            missing.append("AZURE_OPENAI_ENDPOINT")
        if not api_key:
            missing.append("AZURE_OPENAI_API_KEY")
        logging.error(f"Missing environment variables: {', '.join(missing)}")
        return func.HttpResponse(
            json.dumps(
                {
                    "error": f"サーバー設定エラー: 環境変数 {', '.join(missing)} が未設定です。"
                    " Azure Portal の Static Web Apps > 環境変数 で設定してください。"
                }
            ),
            status_code=500,
            mimetype="application/json",
        )

    try:
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )

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

    except Exception as e:
        logging.error(f"Error calling Azure OpenAI: {type(e).__name__}: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"AI応答エラー: {type(e).__name__}: {e}"}),
            status_code=500,
            mimetype="application/json",
        )
