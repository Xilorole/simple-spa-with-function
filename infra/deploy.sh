#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# deploy.sh — Register Entra ID app + deploy infrastructure
# ──────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration (edit these) ───────────────────────────
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-dev}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-swa-func-${ENVIRONMENT_NAME}}"
LOCATION="${LOCATION:-japaneast}"
SWA_NAME="${SWA_NAME:-swa-func-${ENVIRONMENT_NAME}}"
APP_DISPLAY_NAME="${APP_DISPLAY_NAME:-simple-spa-with-function-${ENVIRONMENT_NAME}}"
ENABLE_CUSTOM_AUTH="${ENABLE_CUSTOM_AUTH:-true}"
GITHUB_REPO="${GITHUB_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'Xilorole/simple-spa-with-function')}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_FILE="${SCRIPT_DIR}/main.bicep"

# ─── Colours ──────────────────────────────────────────────
info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[OK]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*"; exit 1; }

# ─── Pre-flight checks ───────────────────────────────────
command -v az >/dev/null 2>&1 || error "Azure CLI (az) is not installed."
az account show >/dev/null 2>&1 || error "Not logged in. Run 'az login' first."

TENANT_ID=$(az account show --query tenantId -o tsv)
info "Tenant:         ${TENANT_ID}"
info "Environment:    ${ENVIRONMENT_NAME}"
info "Resource Group: ${RESOURCE_GROUP}"
info "Location:       ${LOCATION}"
info "SWA Name:       ${SWA_NAME}"
info "Custom Auth:    ${ENABLE_CUSTOM_AUTH}"
echo ""

# ─── 1. Resource Group ────────────────────────────────────
if az group exists --name "${RESOURCE_GROUP}" | grep -q true; then
  info "Resource group '${RESOURCE_GROUP}' already exists."
else
  info "Creating resource group '${RESOURCE_GROUP}' in ${LOCATION}..."
  az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" -o none
  ok "Resource group created."
fi

# ─── 2. Entra ID App Registration (optional) ─────────────
AAD_CLIENT_ID=""
AAD_CLIENT_SECRET=""

if [[ "${ENABLE_CUSTOM_AUTH}" == "true" ]]; then
  info "Setting up Entra ID app registration..."

  # Check if app already exists
  EXISTING_APP_ID=$(az ad app list --display-name "${APP_DISPLAY_NAME}" --query "[0].appId" -o tsv 2>/dev/null || true)

  if [[ -n "${EXISTING_APP_ID}" && "${EXISTING_APP_ID}" != "None" ]]; then
    info "App registration '${APP_DISPLAY_NAME}' already exists (${EXISTING_APP_ID})."
    AAD_CLIENT_ID="${EXISTING_APP_ID}"
  else
    info "Creating app registration '${APP_DISPLAY_NAME}'..."
    AAD_CLIENT_ID=$(az ad app create \
      --display-name "${APP_DISPLAY_NAME}" \
      --sign-in-audience "AzureADMyOrg" \
      --query appId -o tsv)
    ok "App registration created: ${AAD_CLIENT_ID}"
  fi

  # Create a new client secret (valid for 1 year)
  info "Creating client secret..."
  AAD_CLIENT_SECRET=$(az ad app credential reset \
    --id "${AAD_CLIENT_ID}" \
    --display-name "swa-deploy-$(date +%Y%m%d)" \
    --years 1 \
    --query password -o tsv)
  ok "Client secret created."

  echo ""
  warn "Save these values — the secret cannot be retrieved again:"
  echo "  AAD_CLIENT_ID:     ${AAD_CLIENT_ID}"
  echo "  AAD_CLIENT_SECRET: ****${AAD_CLIENT_SECRET: -4}"
  echo ""
fi

# ─── 3. Deploy Bicep ─────────────────────────────────────
info "Deploying infrastructure with Bicep..."

DEPLOY_PARAMS=(
  --resource-group "${RESOURCE_GROUP}"
  --template-file "${BICEP_FILE}"
  --parameters environmentName="${ENVIRONMENT_NAME}"
  --parameters staticWebAppName="${SWA_NAME}"
)

if [[ -n "${AAD_CLIENT_ID}" ]]; then
  DEPLOY_PARAMS+=(--parameters aadClientId="${AAD_CLIENT_ID}")
  DEPLOY_PARAMS+=(--parameters aadClientSecret="${AAD_CLIENT_SECRET}")
fi

az deployment group create "${DEPLOY_PARAMS[@]}" -o table
ok "Infrastructure deployed."

# ─── 4. Update Entra ID redirect URI with actual SWA hostname ──
if [[ -n "${AAD_CLIENT_ID}" ]]; then
  SWA_HOSTNAME=$(az staticwebapp show \
    --name "${SWA_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "defaultHostname" -o tsv)
  REDIRECT_URI="https://${SWA_HOSTNAME}/.auth/login/aad/callback"
  info "Updating Entra ID redirect URI: ${REDIRECT_URI}"
  az ad app update --id "${AAD_CLIENT_ID}" \
    --web-redirect-uris "${REDIRECT_URI}" \
    --enable-id-token-issuance true \
    -o none 2>/dev/null || \
  az ad app update --id "${AAD_CLIENT_ID}" \
    --web-redirect-uris "${REDIRECT_URI}" \
    -o none
  ok "Redirect URI set to ${REDIRECT_URI}"
fi

# ─── 5. Get deployment token for CI/CD ────────────────────
echo ""
info "Retrieving SWA deployment token..."
DEPLOY_TOKEN=$(az staticwebapp secrets list \
  --name "${SWA_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "properties.apiKey" -o tsv 2>/dev/null || echo "")

if [[ -n "${DEPLOY_TOKEN}" ]]; then
  ok "Deployment token retrieved."

  if command -v gh >/dev/null 2>&1; then
    info "Setting GitHub Actions secret via gh CLI..."
    echo "${DEPLOY_TOKEN}" | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo "${GITHUB_REPO}"
    ok "Secret AZURE_STATIC_WEB_APPS_API_TOKEN set on ${GITHUB_REPO}"
  else
    warn "gh CLI not found. Set the secret manually:"
    echo "  gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo ${GITHUB_REPO}"
    echo "  Value: ${DEPLOY_TOKEN:0:8}...${DEPLOY_TOKEN: -4}"
  fi
else
  warn "Could not retrieve deployment token. Get it manually from the Azure Portal."
fi

# ─── 6. Summary ───────────────────────────────────────────
if [[ -z "${SWA_HOSTNAME:-}" ]]; then
  SWA_HOSTNAME=$(az staticwebapp show \
    --name "${SWA_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "defaultHostname" -o tsv 2>/dev/null || echo "<pending>")
fi

echo ""
echo "══════════════════════════════════════════════"
echo " Deployment Summary"
echo "══════════════════════════════════════════════"
echo "  SWA URL:      https://${SWA_HOSTNAME}"
echo "  Resource Group: ${RESOURCE_GROUP}"
if [[ -n "${AAD_CLIENT_ID}" ]]; then
  echo "  Entra App ID:   ${AAD_CLIENT_ID}"
  echo "  Tenant ID:      ${TENANT_ID}"
  echo ""
  echo "  Don't forget to add to staticwebapp.config.json:"
  echo '  "auth": {'
  echo '    "identityProviders": {'
  echo '      "azureActiveDirectory": {'
  echo '        "registration": {'
  echo "          \"openIdIssuer\": \"https://login.microsoftonline.com/${TENANT_ID}/v2.0\","
  echo '          "clientIdSettingName": "AZURE_AD_CLIENT_ID",'
  echo '          "clientSecretSettingName": "AZURE_AD_CLIENT_SECRET"'
  echo '        }'
  echo '      }'
  echo '    }'
  echo '  }'
fi
echo "══════════════════════════════════════════════"
