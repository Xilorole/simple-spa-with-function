import azure.functions as func
import json
import logging
import os
from openai import AzureOpenAI

app = func.FunctionApp()


@app.route(route="chat", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """Azure OpenAI にメッセージを送信して回答を返す"""
    logging.info("chat function triggered")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "リクエストボディが不正です"}),
            status_code=400,
            mimetype="application/json",
        )

    message = body.get("message", "").strip()
    if not message:
        return func.HttpResponse(
            json.dumps({"error": "メッセージが空です"}),
            status_code=400,
            mimetype="application/json",
        )

    # 環境変数から Azure OpenAI の設定を取得
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5-nano")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01")

    if not endpoint or not api_key:
        logging.error("Azure OpenAI の環境変数が設定されていません")
        return func.HttpResponse(
            json.dumps({"error": "サーバー設定エラー"}),
            status_code=500,
            mimetype="application/json",
        )

    try:
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )

        completion = client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": "あなたは親切なアシスタントです。"},
                {"role": "user", "content": message},
            ],
        )

        reply = completion.choices[0].message.content

        return func.HttpResponse(
            json.dumps({"reply": reply}),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Azure OpenAI API エラー: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Azure OpenAI への接続に失敗しました"}),
            status_code=500,
            mimetype="application/json",
        )
