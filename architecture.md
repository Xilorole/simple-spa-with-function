# Architecture: Simple SPA with Azure OpenAI (PoC)

## Overview

A proof-of-concept Single Page Application hosted on **Azure Static Web Apps (SWA)**.  
Users authenticate via **Entra ID**, then interact with **Azure OpenAI** through a managed backend API.

```
┌─────────────────────────────────────────────────────────┐
│                     GitHub Actions                       │
│         (build React → deploy to Azure SWA)             │
└─────────────────┬───────────────────────────────────────┘
                  │ deploys
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Azure Static Web Apps                       │
│                                                          │
│  ┌──────────────────┐     ┌───────────────────────────┐ │
│  │  Static Frontend  │     │  Managed Functions (API)  │ │
│  │  React + Vite     │────▶│  Python 3.11              │ │
│  │  (dist/)          │     │  /api/chat                │ │
│  └──────────────────┘     └───────────┬───────────────┘ │
│                                        │                 │
│  ┌──────────────────┐                  │                 │
│  │  Built-in Auth    │                  │                 │
│  │  Entra ID (AAD)   │                  │                 │
│  │  /.auth/login/aad │                  │                 │
│  └──────────────────┘                  │                 │
└────────────────────────────────────────┼─────────────────┘
                                         │ API Key
                                         ▼
                               ┌──────────────────┐
                               │  Azure OpenAI     │
                               │  (Chat Completion)│
                               └──────────────────┘
```

---

## Project Structure

```
simple-spa-with-function/
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml   # CI/CD pipeline
│
├── api/                                 # Managed Azure Functions backend
│   ├── function_app.py                  #   Python v2 model, /api/chat endpoint
│   ├── requirements.txt                 #   openai SDK
│   └── host.json                        #   Functions host config
│
├── public/                              # Static assets (copied to dist/ on build)
│   └── staticwebapp.config.json         #   SWA routing, auth, platform config
│
├── src/                                 # React source code
│   ├── main.jsx                         #   React entry point
│   ├── App.jsx                          #   Main app component (single page UI)
│   └── App.css                          #   Styles
│
├── index.html                           # Vite HTML entry point
├── package.json                         # Frontend dependencies (react, vite)
├── vite.config.js                       # Vite configuration
├── pyproject.toml                       # Python project metadata
└── README.md                            # Setup & deployment guide
```

---

## Technology Choices

### Frontend — React + Vite

- **Why Vite**: Fast builds, minimal config, outputs static `dist/` folder
- **Build command**: `npm run build` → produces `dist/`
- **No SSR needed** — pure client-side SPA
- **Minimal dependencies**: React only, no heavy UI frameworks for PoC
- **UI**: Single page with:
  - A `<textarea>` for user input (prompt)
  - A "Send" button to call `/api/chat`
  - A response area displaying the Azure OpenAI reply
  - User info + logout button in the header

### Backend — Python Azure Functions (Managed)

- **Python 3.11** (SWA managed functions support up to 3.11, NOT 3.13)
- **Azure Functions v2 programming model** (`function_app.py` with decorators)
- **HTTP trigger only** (managed functions limitation — HTTP triggers only)
- One endpoint: `POST /api/chat` — proxies user prompt to Azure OpenAI
- Uses `openai` Python SDK

### Authentication — SWA Custom Entra ID (Tenant-Restricted)

- **Custom Entra ID app registration** — restricts login to company tenant only
  - Register an app in Entra ID → configure as SWA custom auth provider
  - Set `allowedAudiences` and `tenantId` to lock down to your organization
- **Auth endpoints** (built-in SWA):
  - `/.auth/login/aad` — login via Entra ID (restricted to company tenant)
  - `/.auth/logout` — logout
  - `/.auth/me` — get current user info (JSON)
- Route protection via `staticwebapp.config.json` (restrict `/*` to authenticated users)
- **All other identity providers are blocked** (GitHub, Twitter, etc.)

#### Entra ID App Registration Setup

1. Go to **Azure Portal → Entra ID → App registrations → New registration**
2. Name: e.g., `simple-spa-poc`
3. Supported account types: **"Accounts in this organizational directory only"** (single tenant)
4. Redirect URI: `https://<your-swa-hostname>/.auth/login/aad/callback`
5. Copy **Application (client) ID** and create a **Client Secret**
6. In SWA resource → Settings → Identity providers → Add **Microsoft** provider:
   - Client ID: `<Application (client) ID>`
   - Client Secret: `<Client Secret Value>`
   - Issuer: `https://login.microsoftonline.com/<your-tenant-id>/v2.0`

### Azure OpenAI — API Key Auth

- **Model**: `gpt-5.2-nano` (lightweight, fast, cost-effective for PoC)
- Backend reads from SWA Application Settings (environment variables):
  - `AZURE_OPENAI_ENDPOINT` — e.g., `https://your-resource.openai.azure.com/`
  - `AZURE_OPENAI_API_KEY` — the API key
  - `AZURE_OPENAI_DEPLOYMENT` — the deployment name: `gpt-5.2-nano`
  - `AZURE_OPENAI_API_VERSION` — API version (e.g., `2025-01-01`)
- **Why API Key over Managed Identity**: Managed Identity is NOT supported in SWA managed functions. If we later need it, we'd switch to "Bring Your Own Functions" (linked Azure Functions app).

### CI/CD — GitHub Actions

- Workflow triggers on `push` to `main`
- Uses `Azure/static-web-apps-deploy@v1`
- Requires one secret: `AZURE_STATIC_WEB_APPS_API_TOKEN`

---

## Key Configuration

### staticwebapp.config.json

```jsonc
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"],
    },
    {
      "route": "/.auth/login/github",
      "statusCode": 404,
    },
    {
      "route": "/.auth/login/x",
      "statusCode": 404,
    },
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"],
  },
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad",
    },
  },
  "platform": {
    "apiRuntime": "python:3.11",
  },
}
```

### GitHub Actions Workflow (key settings)

```yaml
app_location: "/" # Root (where package.json lives)
output_location: "dist" # Vite build output
api_location: "api" # Python functions folder
```

---

## Data Flow

### 1. User visits the site

```
Browser → SWA → serves index.html (React SPA from dist/)
```

### 2. Authentication

```
Browser → /.auth/login/aad → Entra ID login flow → redirect back
Browser → /.auth/me → returns { clientPrincipal: { userId, userRoles, ... } }
```

### 3. Chat with Azure OpenAI

```
Browser → POST /api/chat { message: "Hello" }
  → SWA checks auth (must be "authenticated" role)
  → Managed Function receives request
  → function_app.py calls Azure OpenAI API
  → Returns response to browser
```

---

## Azure Resources Required

| Resource                      | Purpose                          | Notes                                         |
| ----------------------------- | -------------------------------- | --------------------------------------------- |
| **Azure Static Web App**      | Hosts frontend + managed API     | Free tier works for PoC                       |
| **Azure OpenAI**              | LLM inference                    | Deploy `gpt-5.2-nano` model                   |
| **Entra ID App Registration** | Restrict login to company tenant | **Required** — single-tenant app registration |

### SWA Application Settings (Environment Variables)

Set these in Azure Portal → Static Web App → Configuration → Application Settings:

| Setting                    | Example Value                             |
| -------------------------- | ----------------------------------------- |
| `AZURE_OPENAI_ENDPOINT`    | `https://your-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY`     | `your-api-key`                            |
| `AZURE_OPENAI_DEPLOYMENT`  | `gpt-5.2-nano`                            |
| `AZURE_OPENAI_API_VERSION` | `2025-01-01`                              |

---

## Limitations of This Architecture (Managed Functions)

| Limitation              | Impact                                          | Mitigation                                      |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------- |
| No Managed Identity     | Must use API keys for Azure OpenAI              | Upgrade to "Bring Your Own Functions" if needed |
| No Key Vault references | Secrets in SWA app settings (encrypted at rest) | Acceptable for PoC                              |
| HTTP triggers only      | Can't use queue/timer/blob triggers             | Fine — we only need HTTP                        |
| Python ≤ 3.11           | Can't use 3.12+ features                        | Minor impact                                    |
| No Durable Functions    | Can't do long-running orchestrations            | Not needed for chat                             |

---

## Future Enhancements (Out of Scope for PoC)

- [ ] Upgrade to "Bring Your Own Functions" for Managed Identity + Key Vault
- [ ] Streaming responses (SSE) from Azure OpenAI
- [ ] Chat history / conversation memory
- [ ] Infrastructure as Code (Bicep/Terraform)
- [ ] Custom domain + SSL
- [ ] Richer UI (multi-turn chat, markdown rendering, etc.)

---

## Decisions Made

| Decision                | Choice                                                  | Rationale                           |
| ----------------------- | ------------------------------------------------------- | ----------------------------------- |
| **Entra ID auth**       | Tenant-restricted (custom app registration)             | PoC is for company users only       |
| **Azure OpenAI model**  | `gpt-5.2-nano`                                          | Lightweight, fast, cost-effective   |
| **Frontend complexity** | Minimal — single page with textarea + button + response | Keep it simple and easy to maintain |
