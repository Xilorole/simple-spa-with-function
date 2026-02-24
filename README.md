# Simple SPA with Azure Functions

Azure Static Web Apps上にデプロイされるシンプルなチャットSPAのPoCです。

## アーキテクチャ

```
├── src/             # React SPA (Vite + TailwindCSS)
├── api/             # Azure Functions (Python, uv管理)
├── .storybook/      # Storybook設定
└── .github/workflows/
    ├── azure-static-web-apps.yml   # SWAデプロイ
    └── deploy-github-pages.yml     # GitHub Pagesデプロイ
```

## ローカル開発

### フロントエンド

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run storybook    # Storybook (http://localhost:6006)
```

### API (Azure Functions)

```bash
cd api
uv sync
uv run func start    # Functions host (http://localhost:7071)
```

### requirements.txt 生成

```bash
npm run api:requirements
# または
cd api && uv export --format requirements-txt --no-hashes -o requirements.txt
```

## ビルド

```bash
npm run build            # SPA → dist/
npm run build-storybook  # Storybook → storybook-static/
```

## デプロイ

### Azure Static Web Apps

- `main`ブランチへのプッシュで自動デプロイ
- `AZURE_STATIC_WEB_APPS_API_TOKEN` シークレットの設定が必要

### GitHub Pages

- `main`ブランチへのプッシュで自動デプロイ
- SPAの静的コピー + `/storybook` パスにStorybookがデプロイされる

## 環境変数 (API)

| 変数名                     | 説明                                             |
| -------------------------- | ------------------------------------------------ |
| `AZURE_OPENAI_ENDPOINT`    | Azure OpenAIのエンドポイントURL                  |
| `AZURE_OPENAI_API_KEY`     | Azure OpenAIのAPIキー                            |
| `AZURE_OPENAI_DEPLOYMENT`  | デプロイメント名 (デフォルト: `gpt-4o`)          |
| `AZURE_OPENAI_API_VERSION` | APIバージョン (デフォルト: `2024-12-01-preview`) |
