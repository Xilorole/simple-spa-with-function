# Simple SPA with Azure OpenAI

Azure Static Web Apps 上で動作するシンプルな SPA（React + Vite）。  
バックエンドの Azure Functions（Python）経由で Azure OpenAI を呼び出します。  
Entra ID 認証でテナント内ユーザーのみアクセス可能です。

## アーキテクチャ

```
ブラウザ → Azure Static Web Apps → Managed Functions (Python) → Azure OpenAI
              ↕                         ↕
         Entra ID 認証              API キー認証
```

詳細は [architecture.md](architecture.md) を参照してください。

## 必要な Azure リソース

| リソース              | 用途                                                 |
| --------------------- | ---------------------------------------------------- |
| Azure Static Web Apps | フロントエンド + API ホスティング（Standard プラン） |
| Azure OpenAI          | LLM 推論（`gpt-5.2-nano` デプロイ）                  |
| Entra ID アプリ登録   | テナント制限認証                                     |

> ⚠️ カスタム認証は **Standard プラン** が必要です（Free プランでは利用不可）。

## セットアップ手順

### 1. Entra ID アプリ登録

1. Azure Portal → **Entra ID** → **アプリの登録** → **新規登録**
2. 名前: `simple-spa-poc`
3. サポートされるアカウントの種類: **この組織ディレクトリのみに含まれるアカウント**（シングルテナント）
4. リダイレクト URI: `https://<your-swa-hostname>/.auth/login/aad/callback`
5. **アプリケーション (クライアント) ID** をコピー
6. **証明書とシークレット** → 新しいクライアントシークレットを作成 → 値をコピー

### 2. Azure Static Web Apps の作成

1. Azure Portal → **Static Web Apps** → **作成**
2. プラン: **Standard**（カスタム認証に必要）
3. GitHub リポジトリと連携（ワークフローは既に `.github/workflows/` に含まれています）
4. ビルド設定:
   - アプリの場所: `/`
   - API の場所: `api`
   - 出力場所: `dist`

### 3. アプリケーション設定（環境変数）

Azure Portal → Static Web Apps → **構成** → **アプリケーション設定** に以下を追加:

| 設定名                     | 値                                        |
| -------------------------- | ----------------------------------------- |
| `AZURE_CLIENT_ID`          | Entra アプリの クライアント ID            |
| `AZURE_CLIENT_SECRET`      | Entra アプリの クライアントシークレット   |
| `AZURE_OPENAI_ENDPOINT`    | `https://your-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY`     | Azure OpenAI の API キー                  |
| `AZURE_OPENAI_DEPLOYMENT`  | `gpt-5.2-nano`                            |
| `AZURE_OPENAI_API_VERSION` | `2025-01-01`                              |

### 4. staticwebapp.config.json の更新

[public/staticwebapp.config.json](public/staticwebapp.config.json) 内の `<YOUR_TENANT_ID>` を実際のテナント ID に置き換えてください。

### 5. デプロイ

`main` ブランチに push すると、GitHub Actions が自動でビルド＆デプロイします。

```bash
git add .
git commit -m "initial commit"
git push origin main
```

### 6. GitHub Secrets の設定

GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions** に追加:

| シークレット名                    | 値                                                                    |
| --------------------------------- | --------------------------------------------------------------------- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA のデプロイトークン（Azure Portal → SWA → デプロイトークンの管理） |

## ローカル開発

```bash
# フロントエンド（Vite dev server）
npm install
npm run dev

# バックエンド（Azure Functions）※ 別ターミナルで
cd api
pip install -r requirements.txt
func start
```

Vite の dev server は `/api` と `/.auth` へのリクエストを `localhost:7071` にプロキシします。

## プロジェクト構成

```
├── .github/workflows/          # GitHub Actions CI/CD
├── api/                        # Azure Functions バックエンド (Python)
│   ├── function_app.py         #   /api/chat エンドポイント
│   ├── requirements.txt        #   Python 依存パッケージ
│   └── host.json               #   Functions ホスト設定
├── public/                     # 静的ファイル（ビルド時に dist/ へコピー）
│   └── staticwebapp.config.json #   SWA ルーティング・認証設定
├── src/                        # React ソースコード
│   ├── main.jsx                #   エントリーポイント
│   ├── App.jsx                 #   メインコンポーネント
│   └── App.css                 #   スタイル
├── index.html                  # Vite HTML エントリー
├── package.json                # フロントエンド依存関係
├── vite.config.js              # Vite 設定
└── architecture.md             # アーキテクチャドキュメント
```
