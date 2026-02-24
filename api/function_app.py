import json
import os
import logging

import azure.functions as func
from openai import AzureOpenAI

app = func.FunctionApp()


@app.route(route="chat", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat(req: func.HttpRequest) -> func.HttpResponse:
    """Chat API endpoint that proxies requests to Azure OpenAI."""
    logging.info("Chat API called")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json",
        )

    messages = body.get("messages", [])
    if not messages:
        return func.HttpResponse(
            json.dumps({"error": "messages is required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        client = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            api_version=os.environ.get(
                "AZURE_OPENAI_API_VERSION", "2024-12-01-preview"
            ),
        )

        response = client.chat.completions.create(
            model=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )

        reply = response.choices[0].message.content

        return func.HttpResponse(
            json.dumps({"reply": reply}),
            status_code=200,
            mimetype="application/json",
        )

    except KeyError as e:
        logging.error(f"Missing environment variable: {e}")
        return func.HttpResponse(
            json.dumps({"error": f"Server configuration error: missing {e}"}),
            status_code=500,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error(f"Error calling Azure OpenAI: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to get response from AI"}),
            status_code=500,
            mimetype="application/json",
        )
